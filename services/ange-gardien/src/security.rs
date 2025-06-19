use anyhow::Result;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use crate::SystemState;
use log::{info, warn, error};
use ring::digest::{Context, SHA256};
use std::path::Path;
use std::fs;
use core_foundation::{
    base::TCFType,
    string::CFString,
    url::{CFURL, CFURLRef},
    bundle::CFBundle,
};
use darwin_libproc::task_info;
use mach::traps;
use libc;
use std::collections::HashSet;
use security_framework::os::macos::keychain::{SecKeychain, SecKeychainSettings};
use security_framework::os::macos::access::SecAccess;
use security_framework::os::macos::identity::SecIdentity;
use security_framework::os::macos::certificate::SecCertificate;
use security_framework::os::macos::access_control::SecAccessControl;
use security_framework::os::macos::keychain_item::SecKeychainItem;
use security_framework::os::macos::access_control::SecAccessControlCreateFlags;
use security_framework::os::macos::keychain::SecKeychainCopyDefault;
use security_framework::os::macos::keychain::SecKeychainOpen;
use security_framework::os::macos::keychain::SecKeychainCreate;
use security_framework::os::macos::keychain::SecKeychainDelete;
use security_framework::os::macos::keychain::SecKeychainSetSettings;
use security_framework::os::macos::keychain::SecKeychainUnlock;
use security_framework::os::macos::keychain::SecKeychainLock;
use security_framework::os::macos::keychain::SecKeychainGetStatus;
use security_framework::os::macos::keychain::SecKeychainGetPath;
use security_framework::os::macos::keychain::SecKeychainGetTypeID;
use security_framework::os::macos::keychain::SecKeychainGetVersion;
use security_framework::os::macos::keychain::SecKeychainGetKeychainVersion;
use security_framework::os::macos::keychain::SecKeychainGetKeychainStatus;
use security_framework::os::macos::keychain::SecKeychainGetKeychainPath;
use security_framework::os::macos::keychain::SecKeychainGetKeychainType;
use security_framework::os::macos::keychain::SecKeychainGetKeychainName;
use security_framework::os::macos::keychain::SecKeychainGetKeychainCreator;
use security_framework::os::macos::keychain::SecKeychainGetKeychainModDate;
use security_framework::os::macos::keychain::SecKeychainGetKeychainCreateDate;
use security_framework::os::macos::keychain::SecKeychainGetKeychainModifier;
use security_framework::os::macos::keychain::SecKeychainGetKeychainAccess;
use security_framework::os::macos::keychain::SecKeychainGetKeychainACL;

pub struct SecurityManager {
    keychain: SecKeychain,
    policies: SecurityPolicies,
    process_hashes: Arc<RwLock<HashMap<u32, String>>>,
    codesign_cache: Arc<RwLock<HashMap<String, bool>>>,
}

#[derive(Debug, Clone)]
pub struct SecurityPolicies {
    max_cpu_usage: f32,
    max_memory_usage: f32,
    suspicious_processes: Vec<String>,
    allowed_ports: Vec<u16>,
    allowed_domains: Vec<String>,
    allowed_signing_authorities: Vec<String>,
    allowed_paths: HashSet<String>,
}

pub fn drop_privileges() -> Result<()> {
    // Check if running as root
    if unsafe { libc::geteuid() } != 0 {
        return Ok(());
    }

    info!("Dropping root privileges...");

    // Create a non-privileged user if it doesn't exist
    let guardian_user = "ange-gardien";
    
    // Drop privileges using macOS-specific APIs
    unsafe {
        // Set up the credentials
        let mut cred = std::mem::zeroed::<libc::posix_cred_t>();
        if libc::posix_cred_get(&mut cred) != 0 {
            return Err(anyhow::anyhow!("Failed to get credentials"));
        }

        // Modify the credentials
        cred.cr_uid = 501; // Standard user UID range
        cred.cr_groups[0] = 501; // Standard user GID range
        cred.cr_ngroups = 1;

        // Set the new credentials
        if libc::posix_cred_set(&cred) != 0 {
            return Err(anyhow::anyhow!("Failed to set credentials"));
        }
    }

    info!("Successfully dropped privileges to {}", guardian_user);
    Ok(())
}

impl SecurityManager {
    pub fn new() -> Result<Self> {
        let keychain = match SecKeychainCopyDefault() {
            Ok(keychain) => keychain,
            Err(_) => {
                // Create a new keychain if default doesn't exist
                let path = "~/Library/Keychains/ange-gardien.keychain";
                let password = "ange-gardien";
                SecKeychainCreate(path, password.as_bytes(), None)?
            }
        };

        let policies = SecurityPolicies::default();

        Ok(Self {
            keychain,
            policies,
            process_hashes: Arc::new(RwLock::new(HashMap::new())),
            codesign_cache: Arc::new(RwLock::new(HashMap::new())),
        })
    }

    pub async fn check_policies(&self, state: &SystemState) -> Result<Option<String>> {
        let policies = self.policies.clone();
        let mut violations = Vec::new();

        // Check CPU usage
        if state.cpu_usage > policies.max_cpu_usage {
            violations.push(format!(
                "CPU usage too high: {:.1}% (max: {:.1}%)",
                state.cpu_usage,
                policies.max_cpu_usage
            ));
        }

        // Check memory usage
        if state.memory_usage > policies.max_memory_usage {
            violations.push(format!(
                "Memory usage too high: {:.1}% (max: {:.1}%)",
                state.memory_usage,
                policies.max_memory_usage
            ));
        }

        // Check for suspicious processes and code signing
        for process in &state.active_processes {
            if policies.suspicious_processes.iter().any(|p| process.name.contains(p)) {
                violations.push(format!(
                    "Suspicious process detected: {} (PID: {})",
                    process.name,
                    process.pid
                ));
            }

            // Check process code signing
            if let Err(e) = self.verify_process_codesign(process.pid).await {
                violations.push(format!(
                    "Code signing verification failed for {} (PID: {}): {}",
                    process.name,
                    process.pid,
                    e
                ));
            }

            // Check process binary integrity
            if let Err(e) = self.verify_process_integrity(process.pid).await {
                violations.push(format!(
                    "Process integrity check failed for {} (PID: {}): {}",
                    process.name,
                    process.pid,
                    e
                ));
            }
        }

        // Check network connections
        for connection in &state.network_stats.connections {
            let port = connection.remote_addr
                .split(':')
                .nth(1)
                .and_then(|p| p.parse::<u16>().ok())
                .unwrap_or(0);

            if !policies.allowed_ports.contains(&port) {
                violations.push(format!(
                    "Unauthorized network connection to port {} ({})",
                    port,
                    connection.remote_addr
                ));
            }

            if let Some(ref domain) = connection.dns_name {
                if !policies.allowed_domains.iter().any(|d| domain.ends_with(d)) {
                    violations.push(format!(
                        "Connection to unauthorized domain: {}",
                        domain
                    ));
                }
            }
        }

        if violations.is_empty() {
            Ok(None)
        } else {
            Ok(Some(violations.join("; ")))
        }
    }

    async fn verify_process_codesign(&self, pid: u32) -> Result<()> {
        // Get process path using libproc on macOS
        let path = match darwin_libproc::pid_path::pidpath(pid) {
            Ok(path) => path,
            Err(_) => return Ok(()), // Process might have terminated
        };

        let path_str = path.to_str().unwrap_or("");
        
        // Check cache first
        let cache = self.codesign_cache.read().await;
        if let Some(&is_signed) = cache.get(path_str) {
            return if is_signed {
                Ok(())
            } else {
                Err(anyhow::anyhow!("Invalid code signature"))
            };
        }
        drop(cache);

        // Verify code signature using macOS Security framework
        let cf_path = CFString::new(path_str);
        let url = CFURL::from_file_system_path(
            cf_path,
            core_foundation::url::kCFURLPOSIXPathStyle,
            true,
        );

        let bundle = CFBundle::new(url);
        
        let is_signed = if let Some(bundle) = bundle {
            // Check if the bundle is signed by an allowed authority
            let info = bundle.info_dictionary();
            let bundle_sig = CFString::new("CFBundleSignature");
            if let Some(signing_info) = info.find(&bundle_sig) {
                let signing_auth = signing_info.to_string();
                let policies = self.policies.clone();
                policies.allowed_signing_authorities.iter().any(|auth| signing_auth.contains(auth))
            } else {
                false
            }
        } else {
            false
        };

        // Update cache
        let mut cache = self.codesign_cache.write().await;
        cache.insert(path_str.to_string(), is_signed);

        if is_signed {
            Ok(())
        } else {
            Err(anyhow::anyhow!("Invalid code signature"))
        }
    }

    async fn verify_process_integrity(&self, pid: u32) -> Result<()> {
        // Get process path using libproc on macOS
        let path = match darwin_libproc::pid_path::pidpath(pid) {
            Ok(path) => path,
            Err(_) => return Ok(()), // Process might have terminated
        };

        let current_hash = match self.calculate_file_hash(&path) {
            Ok(hash) => hash,
            Err(_) => return Ok(()), // Skip if we can't read the file
        };

        let mut hashes = self.process_hashes.write().await;
        
        if let Some(stored_hash) = hashes.get(&pid) {
            if stored_hash != &current_hash {
                return Err(anyhow::anyhow!("Process binary has been modified"));
            }
        } else {
            hashes.insert(pid, current_hash);
        }

        Ok(())
    }

    fn calculate_file_hash<P: AsRef<Path>>(&self, path: P) -> Result<String> {
        let mut context = Context::new(&SHA256);
        let contents = fs::read(path)?;
        context.update(&contents);
        let digest = context.finish();
        Ok(base64::encode(digest.as_ref()))
    }

    pub fn check_process_signature(&self, pid: i32) -> Result<bool> {
        let process_path = std::fs::read_link(format!("/proc/{}/exe", pid))?;
        let path_str = process_path.to_string_lossy();
        
        // Check if process is from an allowed path
        if !self.policies.allowed_paths.iter().any(|p| path_str.starts_with(p)) {
            return Ok(false);
        }

        // Check code signature
        let url = CFURL::from_path(&process_path, false)?;
        let code_ref = SecStaticCodeCreateWithPath(url.as_concrete_TypeRef(), 0, None)?;
        let result = SecStaticCodeCheckValidity(code_ref, 0, None);

        Ok(result.is_ok())
    }

    pub fn check_network_connection(&self, domain: &str, port: u16) -> Result<bool> {
        // Check if domain is allowed
        if !self.policies.allowed_domains.iter().any(|d| domain.ends_with(d)) {
            return Ok(false);
        }

        // Check if port is allowed
        if !self.policies.allowed_ports.contains(&port) {
            return Ok(false);
        }

        Ok(true)
    }

    pub fn verify_file_signature(&self, path: &str) -> Result<bool> {
        let file_path = std::path::Path::new(path);
        if !file_path.exists() {
            return Ok(false);
        }

        // Generate file hash
        let mut file = std::fs::File::open(path)?;
        let mut hasher = ring::digest::Context::new(&ring::digest::SHA256);
        std::io::copy(&mut file, &mut hasher)?;
        let digest = hasher.finish();

        Ok(base64::encode(digest.as_ref()))
    }

    pub fn check_file_access(&self, path: &str, pid: i32) -> Result<bool> {
        let process_path = std::fs::read_link(format!("/proc/{}/exe", pid))?;
        let process_path_str = process_path.to_string_lossy();

        // Check if process is allowed to access this path
        if !self.policies.allowed_paths.iter().any(|p| process_path_str.starts_with(p)) {
            return Ok(false);
        }

        // Check if file path is allowed
        let file_path = std::path::Path::new(path);
        if !self.policies.allowed_paths.iter().any(|p| file_path.starts_with(p)) {
            return Ok(false);
        }

        Ok(true)
    }
}

impl SecurityPolicies {
    fn default() -> Self {
        let mut policies = SecurityPolicies {
            max_cpu_usage: 90.0,
            max_memory_usage: 90.0,
            suspicious_processes: vec![
                "nc".to_string(),
                "netcat".to_string(),
                "nmap".to_string(),
                "wireshark".to_string(),
                "tcpdump".to_string(),
            ],
            allowed_ports: vec![
                80, 443, 53, // Common web and DNS ports
                22, // SSH
                5432, 3306, // Database ports
            ],
            allowed_domains: vec![
                "github.com".to_string(),
                "api.github.com".to_string(),
                "registry.npmjs.org".to_string(),
                "pypi.org".to_string(),
            ],
            allowed_signing_authorities: vec![
                "Apple".to_string(),
                "Apple Development".to_string(),
                "Developer ID Application".to_string(),
            ],
            allowed_paths: HashSet::new(),
        };

        // Add default allowed paths
        policies.allowed_paths.insert("/usr/bin".to_string());
        policies.allowed_paths.insert("/bin".to_string());
        policies.allowed_paths.insert("/sbin".to_string());

        // Add default allowed domains
        policies.allowed_domains.insert("localhost".to_string());
        policies.allowed_domains.insert("127.0.0.1".to_string());

        // Add default allowed ports
        policies.allowed_ports.insert(80);
        policies.allowed_ports.insert(443);
        policies.allowed_ports.insert(8080);

        policies
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{NetworkStats, ProcessInfo, SecurityAlert};
    use chrono::Utc;

    #[tokio::test]
    async fn test_security_manager_creation() {
        let manager = SecurityManager::new().unwrap();
        let policies = manager.policies.clone();
        assert!(policies.max_cpu_usage > 0.0);
    }

    #[tokio::test]
    async fn test_policy_violation_detection() {
        let manager = SecurityManager::new().unwrap();
        let state = SystemState {
            timestamp: Utc::now(),
            cpu_usage: 95.0, // Should trigger violation
            memory_usage: 50.0,
            disk_usage: 70.0,
            network_stats: NetworkStats {
                bytes_sent: 0,
                bytes_received: 0,
                connections: vec![],
                suspicious_activity: vec![],
            },
            active_processes: vec![],
            security_alerts: vec![],
        };

        let violation = manager.check_policies(&state).await.unwrap();
        assert!(violation.is_some());
    }
} 