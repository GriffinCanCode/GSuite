use anyhow::Result;
use pnet::datalink::{self, NetworkInterface};
use pnet::packet::ethernet::{EthernetPacket, EtherTypes};
use pnet::packet::ip::IpNextHeaderProtocols;
use pnet::packet::ipv4::Ipv4Packet;
use pnet::packet::tcp::TcpPacket;
use pnet::packet::udp::UdpPacket;
use pnet::packet::Packet;
use std::collections::HashMap;
use std::net::IpAddr;
use std::sync::Arc;
use tokio::sync::RwLock;
use trust_dns_resolver::Resolver;
use trust_dns_resolver::config::*;
use crate::NetworkStats;
use log::{info, warn};

pub struct NetworkMonitor {
    interfaces: Vec<NetworkInterface>,
    stats: Arc<RwLock<NetworkStats>>,
    connections: Arc<RwLock<HashMap<String, ConnectionInfo>>>,
    resolver: Arc<Resolver>,
}

#[derive(Debug, Clone)]
pub struct ConnectionInfo {
    pub local_addr: String,
    pub remote_addr: String,
    pub protocol: Protocol,
    pub state: ConnectionState,
    pub process_id: Option<u32>,
    pub dns_name: Option<String>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum Protocol {
    TCP,
    UDP,
    ICMP,
    Other(u8),
}

#[derive(Debug, Clone, PartialEq)]
pub enum ConnectionState {
    Established,
    Listen,
    Closed,
    Unknown,
}

impl NetworkMonitor {
    pub fn new() -> Result<Self> {
        let interfaces = datalink::interfaces();
        let resolver = Arc::new(Resolver::new(ResolverConfig::default(), ResolverOpts::default())?);
        
        Ok(Self {
            interfaces,
            stats: Arc::new(RwLock::new(NetworkStats {
                bytes_sent: 0,
                bytes_received: 0,
                connections: Vec::new(),
                suspicious_activity: Vec::new(),
            })),
            connections: Arc::new(RwLock::new(HashMap::new())),
            resolver,
        })
    }

    pub async fn start_monitoring(&self) -> Result<()> {
        let stats = Arc::clone(&self.stats);
        let connections = Arc::clone(&self.connections);

        for interface in self.interfaces.iter() {
            if !interface.is_up() || interface.is_loopback() {
                continue;
            }

            let channel = match datalink::channel(&interface, Default::default()) {
                Ok(datalink::Channel::Ethernet(tx, rx)) => Some((tx, rx)),
                _ => None,
            };

            if let Some((_tx, mut rx)) = channel {
                let stats_clone = Arc::clone(&stats);
                let connections_clone = Arc::clone(&connections);
                let resolver = self.resolver.clone();

                tokio::spawn(async move {
                    loop {
                        match rx.next() {
                            Ok(packet) => {
                                if let Some(ethernet) = EthernetPacket::new(packet) {
                                    Self::process_packet(
                                        &ethernet,
                                        &stats_clone,
                                        &connections_clone,
                                        &resolver,
                                    ).await;
                                }
                            }
                            Err(e) => warn!("Error receiving packet: {}", e),
                        }
                    }
                });
            }
        }

        Ok(())
    }

    async fn process_packet(
        ethernet: &EthernetPacket,
        stats: &Arc<RwLock<NetworkStats>>,
        connections: &Arc<RwLock<HashMap<String, ConnectionInfo>>>,
        resolver: &Resolver,
    ) {
        let mut stats = stats.write().await;
        stats.bytes_received += ethernet.packet().len() as u64;

        match ethernet.get_ethertype() {
            EtherTypes::Ipv4 => {
                if let Some(ipv4) = Ipv4Packet::new(ethernet.payload()) {
                    match ipv4.get_next_level_protocol() {
                        IpNextHeaderProtocols::Tcp => {
                            if let Some(tcp) = TcpPacket::new(ipv4.payload()) {
                                Self::process_tcp_packet(
                                    &ipv4,
                                    &tcp,
                                    connections,
                                    resolver,
                                ).await;
                            }
                        }
                        IpNextHeaderProtocols::Udp => {
                            if let Some(udp) = UdpPacket::new(ipv4.payload()) {
                                Self::process_udp_packet(
                                    &ipv4,
                                    &udp,
                                    connections,
                                    resolver,
                                ).await;
                            }
                        }
                        _ => {}
                    }
                }
            }
            _ => {}
        }
    }

    async fn process_tcp_packet(
        ipv4: &Ipv4Packet,
        tcp: &TcpPacket,
        connections: &Arc<RwLock<HashMap<String, ConnectionInfo>>>,
        resolver: &Resolver,
    ) {
        let mut connections = connections.write().await;
        let connection_key = format!(
            "{}:{}-{}:{}",
            ipv4.get_source(),
            tcp.get_source(),
            ipv4.get_destination(),
            tcp.get_destination()
        );

        if !connections.contains_key(&connection_key) {
            // Perform reverse DNS lookup for new connections
            let remote_addr = IpAddr::V4(ipv4.get_destination());
            let dns_name = match resolver.reverse_lookup(remote_addr) {
                Ok(response) => response.iter().next().map(|name| name.to_string()),
                Err(_) => None,
            };

            let connection = ConnectionInfo {
                local_addr: format!("{}:{}", ipv4.get_source(), tcp.get_source()),
                remote_addr: format!("{}:{}", ipv4.get_destination(), tcp.get_destination()),
                protocol: Protocol::TCP,
                state: if tcp.get_flags() & 0x02 != 0 {
                    ConnectionState::Established
                } else {
                    ConnectionState::Unknown
                },
                process_id: None, // TODO: Implement process tracking
                dns_name,
            };

            connections.insert(connection_key, connection);
        }
    }

    async fn process_udp_packet(
        ipv4: &Ipv4Packet,
        udp: &UdpPacket,
        connections: &Arc<RwLock<HashMap<String, ConnectionInfo>>>,
        resolver: &Resolver,
    ) {
        let mut connections = connections.write().await;
        let connection_key = format!(
            "{}:{}-{}:{}",
            ipv4.get_source(),
            udp.get_source(),
            ipv4.get_destination(),
            udp.get_destination()
        );

        if !connections.contains_key(&connection_key) {
            let remote_addr = IpAddr::V4(ipv4.get_destination());
            let dns_name = match resolver.reverse_lookup(remote_addr) {
                Ok(response) => response.iter().next().map(|name| name.to_string()),
                Err(_) => None,
            };

            let connection = ConnectionInfo {
                local_addr: format!("{}:{}", ipv4.get_source(), udp.get_source()),
                remote_addr: format!("{}:{}", ipv4.get_destination(), udp.get_destination()),
                protocol: Protocol::UDP,
                state: ConnectionState::Unknown,
                process_id: None,
                dns_name,
            };

            connections.insert(connection_key, connection);
        }
    }

    pub async fn get_stats(&self) -> Result<NetworkStats> {
        Ok(self.stats.read().await.clone())
    }

    pub async fn get_active_connections(&self) -> Result<Vec<ConnectionInfo>> {
        let connections = self.connections.read().await;
        Ok(connections.values().cloned().collect())
    }

    pub async fn check_suspicious_activity(&self) -> Result<Vec<String>> {
        let connections = self.connections.read().await;
        let mut suspicious = Vec::new();

        for conn in connections.values() {
            // Check for common malicious ports
            let port = conn.remote_addr.split(':').nth(1).unwrap_or("0").parse::<u16>().unwrap_or(0);
            if Self::is_suspicious_port(port) {
                suspicious.push(format!(
                    "Suspicious connection to port {} from {}",
                    port,
                    conn.remote_addr
                ));
            }

            // Check for known malicious domains
            if let Some(ref dns_name) = conn.dns_name {
                if Self::is_suspicious_domain(dns_name) {
                    suspicious.push(format!(
                        "Connection to suspicious domain: {}",
                        dns_name
                    ));
                }
            }
        }

        Ok(suspicious)
    }

    fn is_suspicious_port(port: u16) -> bool {
        // Add more suspicious ports as needed
        let suspicious_ports = [
            22, // SSH
            23, // Telnet
            445, // SMB
            3389, // RDP
            4444, // Common malware
            5900, // VNC
        ];
        suspicious_ports.contains(&port)
    }

    fn is_suspicious_domain(domain: &str) -> bool {
        // Add more suspicious domain patterns
        let suspicious_patterns = [
            ".xyz",
            ".top",
            "pastebin.com",
            "ngrok.io",
        ];
        suspicious_patterns.iter().any(|&pattern| domain.contains(pattern))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio_test;

    #[tokio::test]
    async fn test_network_monitor_creation() {
        let monitor = NetworkMonitor::new();
        assert!(monitor.is_ok());
    }

    #[tokio::test]
    async fn test_get_stats() {
        let monitor = NetworkMonitor::new().unwrap();
        let stats = monitor.get_stats().await;
        assert!(stats.is_ok());
    }
} 