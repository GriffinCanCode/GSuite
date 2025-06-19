use anyhow::Result;
use pyo3::prelude::*;
use pyo3::types::{PyDict, PyList};
use numpy::{PyArray1, PyArray2};
use crate::SystemState;
use std::sync::Arc;
use tokio::sync::RwLock;
use log::{info, error};

pub struct PythonAnalyzer {
    py_runtime: Arc<RwLock<Option<PyObject>>>,
}

impl PythonAnalyzer {
    pub fn new() -> Result<Self> {
        Python::with_gil(|py| {
            // Initialize Python runtime
            let locals = PyDict::new(py);
            
            // Import required Python modules
            let code = r#"
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
import joblib
import os

class AnomalyDetector:
    def __init__(self):
        self.scaler = StandardScaler()
        self.model = IsolationForest(
            n_estimators=100,
            contamination=0.1,
            random_state=42
        )
        self.is_fitted = False
        
        # Try to load pre-trained model
        model_path = os.path.expanduser('~/.ange-gardien/models/isolation_forest.joblib')
        if os.path.exists(model_path):
            try:
                loaded = joblib.load(model_path)
                self.model = loaded['model']
                self.scaler = loaded['scaler']
                self.is_fitted = True
            except Exception as e:
                print(f"Error loading model: {e}")
    
    def fit(self, X):
        X_scaled = self.scaler.fit_transform(X)
        self.model.fit(X_scaled)
        self.is_fitted = True
        
        # Save the model
        model_path = os.path.expanduser('~/.ange-gardien/models')
        os.makedirs(model_path, exist_ok=True)
        joblib.dump({
            'model': self.model,
            'scaler': self.scaler
        }, os.path.join(model_path, 'isolation_forest.joblib'))
    
    def predict(self, X):
        if not self.is_fitted:
            return np.zeros(X.shape[0])
        X_scaled = self.scaler.transform(X)
        return self.model.predict(X_scaled)
    
    def decision_function(self, X):
        if not self.is_fitted:
            return np.zeros(X.shape[0])
        X_scaled = self.scaler.transform(X)
        return self.model.decision_function(X_scaled)

detector = AnomalyDetector()
"#;
            
            py.run(code, Some(locals), None)?;
            
            // Store the Python objects
            let detector = locals.get_item("detector").unwrap().to_object(py);
            
            Ok(Self {
                py_runtime: Arc::new(RwLock::new(Some(detector))),
            })
        })
    }

    pub async fn analyze_state(&self, states: &[SystemState]) -> Result<Vec<(f64, bool)>> {
        Python::with_gil(|py| {
            let detector = self.py_runtime.read().await
                .as_ref()
                .ok_or_else(|| anyhow::anyhow!("Python runtime not initialized"))?
                .clone_ref(py);

            // Convert states to numpy array
            let features: Vec<f64> = states.iter().flat_map(|state| {
                vec![
                    state.cpu_usage as f64,
                    state.memory_usage as f64,
                    state.disk_usage as f64,
                    state.network_stats.bytes_sent as f64,
                    state.network_stats.bytes_received as f64,
                    state.active_processes.len() as f64,
                ]
            }).collect();

            let n_samples = states.len();
            let n_features = 6;

            // Create a 2D array from the flattened features
            let array = PyArray2::<f64>::new(
                py,
                [n_samples, n_features],
                false
            );
            array.as_slice_mut().unwrap().copy_from_slice(&features);

            // Get predictions and anomaly scores
            let predictions = detector.call_method1(py, "predict", (array,))?;
            let scores = detector.call_method1(py, "decision_function", (array,))?;

            let predictions: Vec<i32> = predictions.extract(py)?;
            let scores: Vec<f64> = scores.extract(py)?;

            // Combine scores with anomaly flags (-1 indicates anomaly)
            let results = scores.into_iter()
                .zip(predictions.into_iter())
                .map(|(score, pred)| (score, pred == -1))
                .collect();

            Ok(results)
        })
    }

    pub async fn train_model(&self, states: &[SystemState]) -> Result<()> {
        Python::with_gil(|py| {
            let detector = self.py_runtime.read().await
                .as_ref()
                .ok_or_else(|| anyhow::anyhow!("Python runtime not initialized"))?
                .clone_ref(py);

            // Convert states to numpy array for training
            let features: Vec<f64> = states.iter().flat_map(|state| {
                vec![
                    state.cpu_usage as f64,
                    state.memory_usage as f64,
                    state.disk_usage as f64,
                    state.network_stats.bytes_sent as f64,
                    state.network_stats.bytes_received as f64,
                    state.active_processes.len() as f64,
                ]
            }).collect();

            let n_samples = states.len();
            let n_features = 6;

            // Create a 2D array from the flattened features
            let array = PyArray2::<f64>::new(
                py,
                [n_samples, n_features],
                false
            );
            array.as_slice_mut().unwrap().copy_from_slice(&features);

            // Train the model
            detector.call_method1(py, "fit", (array,))?;

            Ok(())
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{NetworkStats, ProcessInfo, SecurityAlert};
    use chrono::Utc;

    #[tokio::test]
    async fn test_python_analyzer_creation() {
        let analyzer = PythonAnalyzer::new();
        assert!(analyzer.is_ok());
    }

    #[tokio::test]
    async fn test_anomaly_detection() {
        let analyzer = PythonAnalyzer::new().unwrap();
        let states = vec![
            SystemState {
                timestamp: Utc::now(),
                cpu_usage: 50.0,
                memory_usage: 60.0,
                disk_usage: 70.0,
                network_stats: NetworkStats {
                    bytes_sent: 1000,
                    bytes_received: 1000,
                    connections: vec![],
                    suspicious_activity: vec![],
                },
                active_processes: vec![],
                security_alerts: vec![],
            },
        ];

        let result = analyzer.analyze_state(&states).await;
        assert!(result.is_ok());
    }
} 