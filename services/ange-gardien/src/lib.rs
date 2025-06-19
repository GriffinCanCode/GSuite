use std::{sync::Arc, time::Duration};
use tokio::sync::RwLock;
use anyhow::Result;
use serde::{Serialize, Deserialize};
use chrono::{DateTime, Utc};
use log::{info, warn, error};

mod monitor;
mod database;
mod network;
mod analysis;
mod security;
mod python;
mod time;

pub use analysis::AnomalyDetector;
pub use database::Database;
pub use monitor::SystemMonitor;
pub use network::{NetworkMonitor, NetworkStats, ConnectionInfo};
pub use python::PythonRuntime;
pub use security::SecurityManager;
pub use time::{TimeStamp, utils as time_utils};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemState {
    pub timestamp: DateTime<Utc>,
    pub cpu_usage: f32,
    pub memory_usage: f32,
    pub disk_usage: f32,
    pub network_stats: NetworkStats,
    pub active_processes: Vec<ProcessInfo>,
    pub security_alerts: Vec<SecurityAlert>,
    pub system_metrics: Option<SystemMetrics>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessInfo {
    pub pid: u32,
    pub name: String,
    pub cpu_usage: f32,
    pub memory_usage: f32,
    pub threads: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityAlert {
    pub timestamp: DateTime<Utc>,
    pub severity: AlertSeverity,
    pub description: String,
    pub source: String,
    pub recommendation: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum AlertSeverity {
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemMetrics {
    pub load_average: f64,
    pub io_wait: f64,
    pub context_switches: u64,
    pub interrupts: u64,
}

impl Default for NetworkStats {
    fn default() -> Self {
        Self {
            bytes_sent: 0,
            bytes_received: 0,
            connections: Vec::new(),
            suspicious_activity: Vec::new(),
        }
    }
}

impl Default for SystemMetrics {
    fn default() -> Self {
        Self {
            load_average: 0.0,
            io_wait: 0.0,
            context_switches: 0,
            interrupts: 0,
        }
    }
}

pub struct AngeGardien {
    state: Arc<RwLock<SystemState>>,
    db: Arc<database::Database>,
    monitor: Arc<monitor::SystemMonitor>,
    network_monitor: Arc<network::NetworkMonitor>,
    analyzer: Arc<analysis::Analyzer>,
    security: Arc<security::SecurityManager>,
}

impl AngeGardien {
    pub async fn new() -> Result<Self> {
        let db = Arc::new(database::Database::new()?);
        let monitor = Arc::new(monitor::SystemMonitor::new());
        let network_monitor = Arc::new(network::NetworkMonitor::new()?);
        let analyzer = Arc::new(analysis::Analyzer::new());
        let security = Arc::new(security::SecurityManager::new());

        let initial_state = SystemState {
            timestamp: Utc::now(),
            cpu_usage: 0.0,
            memory_usage: 0.0,
            disk_usage: 0.0,
            network_stats: NetworkStats {
                bytes_sent: 0,
                bytes_received: 0,
                connections: Vec::new(),
                suspicious_activity: Vec::new(),
            },
            active_processes: Vec::new(),
            security_alerts: Vec::new(),
            system_metrics: None,
        };

        Ok(Self {
            state: Arc::new(RwLock::new(initial_state)),
            db,
            monitor,
            network_monitor,
            analyzer,
            security,
        })
    }

    pub async fn start(&self) -> Result<()> {
        info!("Starting Ange Gardien monitoring service...");
        
        let state = Arc::clone(&self.state);
        let db = Arc::clone(&self.db);
        let monitor = Arc::clone(&self.monitor);
        let network_monitor = Arc::clone(&self.network_monitor);
        let analyzer = Arc::clone(&self.analyzer);
        let security = Arc::clone(&self.security);

        // Drop privileges after initialization
        if let Err(e) = security::drop_privileges() {
            error!("Failed to drop privileges: {}", e);
            return Err(anyhow::anyhow!("Failed to drop privileges"));
        }

        tokio::spawn(async move {
            loop {
                if let Err(e) = Self::update_system_state(
                    &state,
                    &db,
                    &monitor,
                    &network_monitor,
                    &analyzer,
                    &security,
                ).await {
                    error!("Error updating system state: {}", e);
                }
                tokio::time::sleep(Duration::from_secs(1)).await;
            }
        });

        Ok(())
    }

    async fn update_system_state(
        state: &Arc<RwLock<SystemState>>,
        db: &Arc<database::Database>,
        monitor: &Arc<monitor::SystemMonitor>,
        network_monitor: &Arc<network::NetworkMonitor>,
        analyzer: &Arc<analysis::Analyzer>,
        security: &Arc<security::SecurityManager>,
    ) -> Result<()> {
        let mut current_state = state.write().await;
        
        // Update system metrics
        current_state.timestamp = Utc::now();
        current_state.cpu_usage = monitor.get_cpu_usage().await?;
        current_state.memory_usage = monitor.get_memory_usage().await?;
        current_state.disk_usage = monitor.get_disk_usage().await?;
        
        // Get detailed system metrics
        current_state.system_metrics = Some(monitor.get_system_metrics().await?);
        
        // Update network statistics
        let network_stats = network_monitor.get_stats().await?;
        current_state.network_stats = network_stats;
        
        // Update process information using the thread pool
        current_state.active_processes = monitor.get_process_list().await?;
        
        // Analyze current state for security threats
        let alerts = analyzer.analyze_state(&current_state).await?;
        current_state.security_alerts.extend(alerts);
        
        // Store state in database
        db.store_state(&current_state).await?;
        
        // Check security policies
        if let Some(violation) = security.check_policies(&current_state).await? {
            warn!("Security policy violation detected: {:?}", violation);
            current_state.security_alerts.push(SecurityAlert {
                timestamp: Utc::now(),
                severity: AlertSeverity::High,
                description: violation,
                source: "Security Policy Check".to_string(),
                recommendation: None,
            });
        }

        Ok(())
    }

    pub async fn get_current_state(&self) -> Result<SystemState> {
        Ok(self.state.read().await.clone())
    }

    pub async fn get_alerts(&self, since: DateTime<Utc>) -> Result<Vec<SecurityAlert>> {
        self.db.get_alerts_since(since).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio_test;

    #[tokio::test]
    async fn test_ange_gardien_creation() {
        let guardian = AngeGardien::new().await;
        assert!(guardian.is_ok());
    }

    #[tokio::test]
    async fn test_system_state_update() {
        let guardian = AngeGardien::new().await.unwrap();
        let initial_state = guardian.get_current_state().await.unwrap();
        assert_eq!(initial_state.active_processes.len(), 0);
    }
} 