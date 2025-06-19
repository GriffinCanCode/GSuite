use anyhow::Result;
use chrono::{DateTime, Utc};
use diesel::prelude::*;
use diesel::sqlite::{Sqlite, SqliteConnection};
use diesel::r2d2::{ConnectionManager, Pool};
use diesel::sql_types::Timestamp;
use diesel::serialize::{ToSql, Output};
use diesel::deserialize::{FromSql, FromSqlRow};
use diesel::expression::AsExpression;
use serde_json;
use std::path::PathBuf;
use directories::ProjectDirs;
use crate::{SystemState, SecurityAlert, NetworkStats, AlertSeverity};
use log::{info, error};
use crate::time::TimeStamp;

#[derive(FromSqlRow, AsExpression)]
#[diesel(sql_type = Timestamp)]
pub struct DateTimeUtc(DateTime<Utc>);

impl From<DateTime<Utc>> for DateTimeUtc {
    fn from(dt: DateTime<Utc>) -> Self {
        DateTimeUtc(dt)
    }
}

impl From<DateTimeUtc> for DateTime<Utc> {
    fn from(dt: DateTimeUtc) -> Self {
        dt.0
    }
}

impl FromSql<Timestamp, Sqlite> for DateTimeUtc {
    fn from_sql(bytes: diesel::backend::RawValue<'_, Sqlite>) -> diesel::deserialize::Result<Self> {
        let ts = <String as FromSql<Timestamp, Sqlite>>::from_sql(bytes)?;
        Ok(DateTimeUtc(
            DateTime::parse_from_rfc3339(&ts)
                .map_err(|e| format!("Failed to parse timestamp: {}", e))?
                .with_timezone(&Utc)
        ))
    }
}

impl ToSql<Timestamp, Sqlite> for DateTimeUtc {
    fn to_sql<'b>(&'b self, out: &mut Output<'b, '_, Sqlite>) -> diesel::serialize::Result {
        let s = self.0.to_rfc3339();
        <String as ToSql<Timestamp, Sqlite>>::to_sql(&s, out)
    }
}

// Database schema
table! {
    system_states (id) {
        id -> Nullable<Integer>,
        timestamp -> Timestamp,
        cpu_usage -> Float,
        memory_usage -> Float,
        disk_usage -> Float,
        network_stats -> Text,
        processes -> Text,
        alerts -> Text,
    }
}

table! {
    security_alerts (id) {
        id -> Nullable<Integer>,
        timestamp -> Timestamp,
        severity -> Text,
        description -> Text,
        source -> Text,
        recommendation -> Nullable<Text>,
    }
}

#[derive(Debug, Queryable, Insertable, Selectable)]
#[diesel(table_name = system_states)]
#[diesel(check_for_backend(Sqlite))]
struct SystemStateRecord {
    id: Option<i32>,
    timestamp: TimeStamp,
    cpu_usage: f32,
    memory_usage: f32,
    disk_usage: f32,
    network_stats: String,
    processes: String,
    alerts: String,
}

#[derive(Debug, Queryable, Insertable, Selectable)]
#[diesel(table_name = security_alerts)]
#[diesel(check_for_backend(Sqlite))]
struct SecurityAlertRecord {
    id: Option<i32>,
    timestamp: TimeStamp,
    severity: String,
    description: String,
    source: String,
    recommendation: Option<String>,
}

pub struct Database {
    pool: Pool<ConnectionManager<SqliteConnection>>,
}

impl Database {
    pub fn new() -> Result<Self> {
        let project_dirs = ProjectDirs::from("com", "ange-gardien", "monitor")
            .ok_or_else(|| anyhow::anyhow!("Failed to get project directories"))?;
        
        let data_dir = project_dirs.data_dir();
        std::fs::create_dir_all(data_dir)?;
        
        let database_url = data_dir.join("monitor.db");
        let manager = ConnectionManager::<SqliteConnection>::new(database_url.to_str().unwrap());
        let pool = Pool::builder()
            .max_size(10)
            .build(manager)?;

        // Initialize database
        let mut connection = pool.get()?;
        Self::initialize_database(&mut connection)?;

        Ok(Self { pool })
    }

    fn initialize_database(connection: &mut SqliteConnection) -> Result<()> {
        diesel::sql_query(
            r#"
            CREATE TABLE IF NOT EXISTS system_states (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TIMESTAMP NOT NULL,
                cpu_usage REAL NOT NULL,
                memory_usage REAL NOT NULL,
                disk_usage REAL NOT NULL,
                network_stats TEXT NOT NULL,
                processes TEXT NOT NULL,
                alerts TEXT NOT NULL
            )
            "#,
        ).execute(connection)?;

        diesel::sql_query(
            r#"
            CREATE TABLE IF NOT EXISTS security_alerts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TIMESTAMP NOT NULL,
                severity TEXT NOT NULL,
                description TEXT NOT NULL,
                source TEXT NOT NULL,
                recommendation TEXT
            )
            "#,
        ).execute(connection)?;

        diesel::sql_query(
            "CREATE INDEX IF NOT EXISTS idx_system_states_timestamp ON system_states(timestamp)"
        ).execute(connection)?;
        
        diesel::sql_query(
            "CREATE INDEX IF NOT EXISTS idx_security_alerts_timestamp ON security_alerts(timestamp)"
        ).execute(connection)?;

        Ok(())
    }

    pub async fn store_state(&self, state: &SystemState) -> Result<()> {
        let mut connection = self.pool.get()?;
        
        let record = SystemStateRecord {
            id: None,
            timestamp: TimeStamp::from(state.timestamp),
            cpu_usage: state.cpu_usage,
            memory_usage: state.memory_usage,
            disk_usage: state.disk_usage,
            network_stats: serde_json::to_string(&state.network_stats)?,
            processes: serde_json::to_string(&state.active_processes)?,
            alerts: serde_json::to_string(&state.security_alerts)?,
        };

        diesel::insert_into(system_states::table)
            .values(&record)
            .execute(&mut connection)?;

        // Store security alerts separately for better querying
        for alert in &state.security_alerts {
            let alert_record = SecurityAlertRecord {
                id: None,
                timestamp: TimeStamp::from(alert.timestamp),
                severity: format!("{:?}", alert.severity),
                description: alert.description.clone(),
                source: alert.source.clone(),
                recommendation: alert.recommendation.clone(),
            };

            diesel::insert_into(security_alerts::table)
                .values(&alert_record)
                .execute(&mut connection)?;
        }

        Ok(())
    }

    pub async fn get_alerts_since(&self, since: DateTime<Utc>) -> Result<Vec<SecurityAlert>> {
        let mut connection = self.pool.get()?;
        let since_ts = TimeStamp::from(since);
        
        let records = security_alerts::table
            .filter(security_alerts::timestamp.gt(since_ts))
            .order_by(security_alerts::timestamp.desc())
            .select(SecurityAlertRecord::as_select())
            .load::<SecurityAlertRecord>(&mut connection)?;

        let alerts = records.into_iter()
            .map(|record| SecurityAlert {
                timestamp: record.timestamp.inner(),
                severity: serde_json::from_str(&record.severity).unwrap_or(AlertSeverity::Low),
                description: record.description,
                source: record.source,
                recommendation: record.recommendation,
            })
            .collect();

        Ok(alerts)
    }

    pub async fn get_system_states(&self, limit: i64) -> Result<Vec<SystemState>> {
        let mut connection = self.pool.get()?;
        
        let records = system_states::table
            .order_by(system_states::timestamp.desc())
            .limit(limit)
            .select(SystemStateRecord::as_select())
            .load::<SystemStateRecord>(&mut connection)?;

        let states = records.into_iter()
            .map(|record| SystemState {
                timestamp: record.timestamp.inner(),
                cpu_usage: record.cpu_usage,
                memory_usage: record.memory_usage,
                disk_usage: record.disk_usage,
                network_stats: serde_json::from_str(&record.network_stats).unwrap_or_else(|_| NetworkStats {
                    bytes_sent: 0,
                    bytes_received: 0,
                    connections: Vec::new(),
                    suspicious_activity: Vec::new(),
                }),
                active_processes: serde_json::from_str(&record.processes).unwrap_or_default(),
                security_alerts: serde_json::from_str(&record.alerts).unwrap_or_default(),
                system_metrics: None,
            })
            .collect();

        Ok(states)
    }

    pub async fn cleanup_old_records(&self, older_than: DateTime<Utc>) -> Result<()> {
        let mut connection = self.pool.get()?;
        let older_than_ts = TimeStamp::from(older_than);
        
        diesel::delete(system_states::table)
            .filter(system_states::timestamp.lt(&older_than_ts))
            .execute(&mut connection)?;

        diesel::delete(security_alerts::table)
            .filter(security_alerts::timestamp.lt(&older_than_ts))
            .execute(&mut connection)?;

        // Vacuum database to reclaim space
        diesel::sql_query("VACUUM").execute(&mut connection)?;

        Ok(())
    }

    pub async fn get_statistics(&self, since: DateTime<Utc>) -> Result<SystemStatistics> {
        let mut connection = self.pool.get()?;
        let since_ts = TimeStamp::from(since);
        
        let stats = diesel::sql_query(
            r#"
            SELECT 
                AVG(cpu_usage) as avg_cpu,
                AVG(memory_usage) as avg_memory,
                AVG(disk_usage) as avg_disk,
                COUNT(*) as total_records,
                (SELECT COUNT(*) FROM security_alerts WHERE timestamp > ?) as alert_count
            FROM system_states
            WHERE timestamp > ?
            "#
        )
        .bind::<Timestamp, _>(&since_ts)
        .bind::<Timestamp, _>(&since_ts)
        .get_result::<SystemStatistics>(&mut connection)?;

        Ok(stats)
    }
}

#[derive(QueryableByName)]
struct SystemStatistics {
    #[diesel(sql_type = diesel::sql_types::Double)]
    avg_cpu: f64,
    #[diesel(sql_type = diesel::sql_types::Double)]
    avg_memory: f64,
    #[diesel(sql_type = diesel::sql_types::Double)]
    avg_disk: f64,
    #[diesel(sql_type = diesel::sql_types::BigInt)]
    total_records: i64,
    #[diesel(sql_type = diesel::sql_types::BigInt)]
    alert_count: i64,
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_database_creation() {
        let db = Database::new();
        assert!(db.is_ok());
    }

    #[tokio::test]
    async fn test_store_and_retrieve_state() {
        let db = Database::new().unwrap();
        let state = SystemState {
            timestamp: Utc::now(),
            cpu_usage: 50.0,
            memory_usage: 60.0,
            disk_usage: 70.0,
            network_stats: Default::default(),
            active_processes: vec![],
            security_alerts: vec![],
            system_metrics: None,
        };

        assert!(db.store_state(&state).await.is_ok());
        let states = db.get_system_states(1).await.unwrap();
        assert_eq!(states.len(), 1);
    }
} 