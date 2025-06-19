use chrono::{DateTime, Utc};
use diesel::sql_types::Timestamp;
use diesel::sqlite::Sqlite;
use diesel::serialize::{ToSql, Output, IsNull};
use diesel::deserialize::{FromSql, FromSqlRow};
use diesel::expression::AsExpression;
use std::str::FromStr;

/// A wrapper type for DateTime<Utc> that implements necessary Diesel traits
#[derive(Debug, Clone, FromSqlRow, AsExpression)]
#[diesel(sql_type = Timestamp)]
pub struct TimeStamp(pub DateTime<Utc>);

impl TimeStamp {
    /// Creates a new TimeStamp with the current UTC time
    pub fn now() -> Self {
        TimeStamp(Utc::now())
    }

    /// Gets the inner DateTime<Utc>
    pub fn inner(&self) -> DateTime<Utc> {
        self.0
    }
}

impl From<DateTime<Utc>> for TimeStamp {
    fn from(dt: DateTime<Utc>) -> Self {
        TimeStamp(dt)
    }
}

impl From<TimeStamp> for DateTime<Utc> {
    fn from(ts: TimeStamp) -> Self {
        ts.0
    }
}

impl FromSql<Timestamp, Sqlite> for TimeStamp {
    fn from_sql(bytes: diesel::backend::RawValue<'_, Sqlite>) -> diesel::deserialize::Result<Self> {
        let ts = <i64 as FromSql<Timestamp, Sqlite>>::from_sql(bytes)?;
        Ok(TimeStamp(DateTime::from_timestamp(ts, 0).unwrap_or_else(|| Utc::now())))
    }
}

impl ToSql<Timestamp, Sqlite> for TimeStamp {
    fn to_sql<'b>(&'b self, out: &mut Output<'b, '_, Sqlite>) -> diesel::serialize::Result {
        let timestamp = self.0.timestamp();
        <i64 as ToSql<Timestamp, Sqlite>>::to_sql(&timestamp, out)
    }
}

// Add common time-related utility functions
pub mod utils {
    use super::*;
    use std::time::{Duration, SystemTime, UNIX_EPOCH};

    /// Convert a SystemTime to DateTime<Utc>
    pub fn system_time_to_datetime(time: SystemTime) -> DateTime<Utc> {
        let duration = time.duration_since(UNIX_EPOCH)
            .unwrap_or_else(|_| Duration::from_secs(0));
        let secs = duration.as_secs() as i64;
        let nsecs = duration.subsec_nanos();
        DateTime::<Utc>::from_timestamp(secs, nsecs).unwrap_or_else(|| Utc::now())
    }

    /// Get duration since a DateTime<Utc>
    pub fn duration_since(time: DateTime<Utc>) -> Duration {
        Utc::now()
            .signed_duration_since(time)
            .to_std()
            .unwrap_or_else(|_| Duration::from_secs(0))
    }
} 