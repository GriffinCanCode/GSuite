use anyhow::Result;
use sysinfo::{System, SystemExt, ProcessExt, CpuExt};
use chrono::{DateTime, Utc};
use crate::ProcessInfo;
use log::{info, warn};
use std::sync::Arc;
use tokio::sync::RwLock;
use time::OffsetDateTime;
use num_cpus;
use threadpool::ThreadPool;
use darwin_libproc::pid_rusage;
use mach::{kern_return, message, port, traps, vm_types};
use core_foundation::{
    base::TCFType,
    dictionary::CFDictionary,
    string::CFString,
    number::CFNumber,
};
use std::collections::HashMap;
use std::time::Duration;
use serde::{Serialize, Deserialize};
use crate::{SystemState, NetworkStats};

pub struct SystemMonitor {
    sys: Arc<RwLock<System>>,
    thread_pool: ThreadPool,
    last_update: Arc<RwLock<OffsetDateTime>>,
    process_history: Arc<RwLock<HashMap<u32, ProcessHistory>>>,
}

#[derive(Clone, Debug)]
struct ProcessHistory {
    cpu_usage: Vec<f32>,
    memory_usage: Vec<u64>,
    timestamp: Vec<DateTime<Utc>>,
}

impl SystemMonitor {
    pub fn new() -> Self {
        let mut sys = System::new_all();
        sys.refresh_all();
        
        // Create a thread pool with number of threads equal to CPU cores
        let num_threads = num_cpus::get();
        let thread_pool = ThreadPool::new(num_threads);
        
        Self {
            sys: Arc::new(RwLock::new(sys)),
            thread_pool,
            last_update: Arc::new(RwLock::new(OffsetDateTime::now_utc())),
            process_history: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn get_system_state(&self) -> Result<SystemState> {
        let mut sys = self.sys.write().await;
        sys.refresh_all();

        let cpu_usage = sys.global_cpu_info().cpu_usage().min(100.0) as f32;
        
        let total_memory = sys.total_memory().max(1) as f32;  // Prevent division by zero
        let used_memory = (sys.total_memory() - sys.available_memory()) as f32;
        let memory_usage = (used_memory / total_memory * 100.0).min(100.0);

        let mut disk_usage = 0.0;
        let mut disk_count = 0;
        for disk in sys.disks() {
            let total = disk.total_space() as f32;
            if total > 0.0 {  // Skip zero-sized disks
                let used = (disk.total_space() - disk.available_space()) as f32;
                disk_usage += (used / total * 100.0).min(100.0);
                disk_count += 1;
            }
        }
        if disk_count > 0 {
            disk_usage /= disk_count as f32;
        }

        let mut active_processes = Vec::new();
        for (pid, process) in sys.processes() {
            // Skip processes with invalid memory usage
            let proc_memory = process.memory();
            if proc_memory == 0 || total_memory == 0.0 {
                continue;
            }

            let memory_percentage = ((proc_memory as f32 / total_memory) * 100.0).min(100.0);
            
            let process_info = ProcessInfo {
                pid: pid.as_u32(),
                name: process.name().to_string(),
                cpu_usage: process.cpu_usage().min(100.0) as f32,
                memory_usage: memory_percentage,
                threads: process.thread_count().max(1) as u32,  // Ensure at least 1 thread
            };
            active_processes.push(process_info);
        }

        Ok(SystemState {
            timestamp: chrono::Utc::now(),
            cpu_usage,
            memory_usage,
            disk_usage,
            network_stats: NetworkStats::default(),
            active_processes,
            security_alerts: Vec::new(),
            system_metrics: None,
        })
    }

    pub async fn get_cpu_usage(&self) -> Result<f32> {
        let mut sys = self.sys.write().await;
        sys.refresh_cpu();
        
        let cpu_usage = sys.global_cpu_info().cpu_usage();
        Ok(cpu_usage)
    }

    pub async fn get_memory_usage(&self) -> Result<f32> {
        let sys = self.sys.read().await;
        let total_memory = sys.total_memory() as f32;
        let used_memory = sys.used_memory() as f32;
        
        Ok((used_memory / total_memory) * 100.0)
    }

    pub async fn get_disk_usage(&self) -> Result<f32> {
        let sys = self.sys.read().await;
        let mut total_usage = 0.0;
        let mut disk_count = 0;

        for disk in sys.disks() {
            let total = disk.total_space() as f32;
            let used = (disk.total_space() - disk.available_space()) as f32;
            total_usage += (used / total) * 100.0;
            disk_count += 1;
        }

        Ok(total_usage / disk_count as f32)
    }

    pub async fn get_process_list(&self) -> Result<Vec<ProcessInfo>> {
        let sys = self.sys.read().await;
        let mut processes = Vec::new();
        let (tx, rx) = std::sync::mpsc::channel();

        for (pid, process) in sys.processes() {
            let tx = tx.clone();
            let process_name = process.name().to_string();
            let process_cpu = process.cpu_usage();
            let process_memory = process.memory();
            let process_threads = process.thread_count();
            let process_cmd = process.cmd().join(" ");
            let process_start = process.start_time();

            self.thread_pool.execute(move || {
                // Get macOS-specific process information using libproc
                if let Ok(rusage) = pid_rusage::pidrusage(*pid) {
                    let process_info = ProcessInfo {
                        pid: *pid,
                        name: process_name,
                        cpu_usage: process_cpu,
                        memory_usage: process_memory,
                        threads: process_threads,
                        start_time: DateTime::from_timestamp(
                            process_start as i64,
                            0
                        ).unwrap_or_else(|| Utc::now()),
                        command: process_cmd,
                    };

                    let _ = tx.send(process_info);
                }
            });
        }

        drop(tx);

        // Collect results from the thread pool
        for process_info in rx.iter() {
            processes.push(process_info);
        }

        // Update process history
        let mut history = self.process_history.write().await;
        let current_time = Utc::now();

        for process in &processes {
            let history_entry = history.entry(process.pid).or_insert_with(|| ProcessHistory {
                cpu_usage: Vec::new(),
                memory_usage: Vec::new(),
                timestamp: Vec::new(),
            });

            // Keep last hour of data (3600 seconds)
            while !history_entry.timestamp.is_empty() && 
                  (current_time - history_entry.timestamp[0]).num_seconds() > 3600 {
                history_entry.cpu_usage.remove(0);
                history_entry.memory_usage.remove(0);
                history_entry.timestamp.remove(0);
            }

            history_entry.cpu_usage.push(process.cpu_usage);
            history_entry.memory_usage.push(process.memory_usage);
            history_entry.timestamp.push(current_time);
        }

        // Update last update time
        *self.last_update.write().await = OffsetDateTime::now_utc();

        // Sort by CPU usage for quick identification of resource-intensive processes
        processes.sort_by(|a, b| b.cpu_usage.partial_cmp(&a.cpu_usage).unwrap());

        Ok(processes)
    }

    pub async fn get_thread_info(&self) -> Result<Vec<ThreadInfo>> {
        unsafe {
            let task = traps::mach_task_self();
            let mut thread_list: port::mach_port_array_t = std::ptr::null_mut();
            let mut thread_count: mach_msg_type_number_t = 0;

            let kr = traps::task_threads(
                task,
                &mut thread_list,
                &mut thread_count,
            );

            if kr != kern_return::KERN_SUCCESS {
                return Err(anyhow::anyhow!("Failed to get task threads"));
            }

            let threads = std::slice::from_raw_parts(thread_list, thread_count as usize)
                .iter()
                .filter_map(|&thread| {
                    let mut thread_info = thread_basic_info::default();
                    let mut count = THREAD_BASIC_INFO_COUNT;

                    let kr = thread_info(
                        thread,
                        THREAD_BASIC_INFO,
                        &mut thread_info as *mut _ as thread_info_t,
                        &mut count,
                    );

                    if kr == kern_return::KERN_SUCCESS {
                        Some(ThreadInfo {
                            cpu_usage: thread_info.cpu_usage as f32 / TH_USAGE_SCALE as f32,
                            run_time: thread_info.user_time.seconds as f64
                                + thread_info.system_time.seconds as f64,
                        })
                    } else {
                        None
                    }
                })
                .collect();

            vm_deallocate(
                task,
                thread_list as vm_address_t,
                (thread_count as usize * std::mem::size_of::<mach_port_t>()) as vm_size_t,
            );

            Ok(threads)
        }
    }

    pub async fn monitor_process_creation(&self) -> Result<()> {
        let sys = self.sys.read().await;
        let current_processes: Vec<u32> = sys.processes().keys().cloned().collect();
        
        info!("Monitoring {} processes", current_processes.len());
        
        Ok(())
    }

    pub async fn get_system_metrics(&self) -> Result<SystemMetrics> {
        let sys = self.sys.read().await;
        let num_physical_cores = num_cpus::get_physical();
        let num_logical_cores = num_cpus::get();
        
        Ok(SystemMetrics {
            cpu_count: num_logical_cores,
            physical_cpu_count: num_physical_cores,
            last_update: *self.last_update.read().await,
            uptime: sys.uptime(),
            load_average: sys.load_average().one,
        })
    }

    pub async fn get_process_history(&self, pid: u32) -> Option<ProcessHistory> {
        let history = self.process_history.read().await;
        history.get(&pid).cloned()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemMetrics {
    pub cpu_count: usize,
    pub physical_cpu_count: usize,
    pub last_update: OffsetDateTime,
    pub uptime: u64,
    pub load_average: f64,
}

#[derive(Debug)]
struct ThreadInfo {
    cpu_usage: f32,
    run_time: f64,
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio_test;

    #[tokio::test]
    async fn test_cpu_usage() {
        let monitor = SystemMonitor::new();
        let usage = monitor.get_cpu_usage().await;
        assert!(usage.is_ok());
        assert!(usage.unwrap() >= 0.0);
    }

    #[tokio::test]
    async fn test_memory_usage() {
        let monitor = SystemMonitor::new();
        let usage = monitor.get_memory_usage().await;
        assert!(usage.is_ok());
        assert!(usage.unwrap() >= 0.0);
    }

    #[tokio::test]
    async fn test_process_list() {
        let monitor = SystemMonitor::new();
        let processes = monitor.get_process_list().await;
        assert!(processes.is_ok());
        assert!(!processes.unwrap().is_empty());
    }
} 