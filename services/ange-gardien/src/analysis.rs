use anyhow::Result;
use linfa::prelude::*;
use linfa_clustering::{DbscanParams, Dbscan};
use ndarray::{Array1, Array2, Axis};
use crate::{SystemState, SecurityAlert, AlertSeverity};
use std::collections::VecDeque;
use std::sync::Arc;
use tokio::sync::RwLock;
use chrono::{DateTime, Utc, Duration};
use log::{info, warn};
use linfa_nn::{distance::{L2Dist, Distance}, CommonNearestNeighbour};

const HISTORY_WINDOW: usize = 3600; // 1 hour of data points (1 per second)
const ANOMALY_THRESHOLD: f64 = 2.0; // Standard deviations for anomaly detection

pub struct AnomalyDetector {
    history: Vec<SystemState>,
    model: Option<Dbscan<f64, L2Dist, CommonNearestNeighbour>>,
}

impl AnomalyDetector {
    pub fn new() -> Self {
        Self {
            history: Vec::new(),
            model: None,
        }
    }

    pub fn add_state(&mut self, state: SystemState) {
        self.history.push(state);
        if self.history.len() > 1000 {
            self.history.remove(0);
        }
    }

    pub fn detect_anomalies(&mut self) -> Vec<SecurityAlert> {
        let mut alerts = Vec::new();
        
        if self.history.len() < 10 {
            return alerts;
        }

        // Extract features
        let features = self.extract_features();
        
        // Train model if needed
        if self.model.is_none() {
            self.train_model(&features);
        }

        // Detect anomalies
        if let Some(model) = &self.model {
            let latest_state = &self.history[self.history.len() - 1];
            let latest_features = self.state_to_features(latest_state);
            
            let dataset = DatasetBase::from(Array2::from_shape_vec((1, latest_features.len()), latest_features).unwrap());
            let prediction = model.predict(&dataset);

            // Check if the latest state is an anomaly
            if prediction[0] == -1 {
                alerts.push(SecurityAlert {
                    timestamp: Utc::now(),
                    severity: AlertSeverity::Medium,
                    description: "Anomalous system behavior detected".to_string(),
                    source: "AnomalyDetector".to_string(),
                    recommendation: Some("Investigate unusual system activity".to_string()),
                });
            }
        }

        alerts
    }

    fn extract_features(&self) -> Array2<f64> {
        let n_samples = self.history.len();
        let n_features = 5; // CPU, Memory, Disk, Network I/O, Process Count
        
        let mut features = Vec::with_capacity(n_samples * n_features);
        
        for state in &self.history {
            let state_features = self.state_to_features(state);
            features.extend(state_features);
        }
        
        Array2::from_shape_vec((n_samples, n_features), features)
            .expect("Failed to create feature matrix")
    }

    fn state_to_features(&self, state: &SystemState) -> Vec<f64> {
        vec![
            state.cpu_usage as f64,
            state.memory_usage as f64,
            state.disk_usage as f64,
            state.network_stats.bytes_sent as f64 + state.network_stats.bytes_received as f64,
            state.active_processes.len() as f64,
        ]
    }

    fn train_model(&mut self, features: &Array2<f64>) {
        let dataset = DatasetBase::from(features.clone());
        
        let params = DbscanParams::new(5)
            .tolerance(0.5)
            .distance(L2Dist)
            .algorithm(CommonNearestNeighbour::new());
            
        self.model = Some(Dbscan::params(params).fit(&dataset).expect("Failed to train DBSCAN model"));
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::NetworkStats;

    #[test]
    fn test_anomaly_detector() {
        let mut detector = AnomalyDetector::new();
        
        // Add normal states
        for _ in 0..10 {
            let state = SystemState {
                timestamp: Utc::now(),
                cpu_usage: 30.0,
                memory_usage: 40.0,
                disk_usage: 50.0,
                network_stats: NetworkStats::default(),
                active_processes: vec![],
                security_alerts: vec![],
                system_metrics: None,
            };
            detector.add_state(state);
        }
        
        // Add anomalous state
        let anomalous_state = SystemState {
            timestamp: Utc::now(),
            cpu_usage: 95.0,
            memory_usage: 90.0,
            disk_usage: 95.0,
            network_stats: NetworkStats::default(),
            active_processes: vec![],
            security_alerts: vec![],
            system_metrics: None,
        };
        detector.add_state(anomalous_state);
        
        let alerts = detector.detect_anomalies();
        assert!(!alerts.is_empty());
    }
} 