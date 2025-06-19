"""
System configuration for M4 Max optimized resource management.
"""

from dataclasses import dataclass
from enum import Enum
import multiprocessing


class CoreType(Enum):
    """Enum for different core types in M4 Max"""

    PERFORMANCE = "performance"
    EFFICIENCY = "efficiency"


@dataclass
class M4MaxConfig:
    """M4 Max specific system configurations"""

    model_name: str = "MacBook Pro"
    model_identifier: str = "Mac16,5"
    model_number: str = "Z1FW00086LL/A"
    chip: str = "Apple M4 Max"
    performance_cores: int = 12
    efficiency_cores: int = 4
    total_cores: int = 16
    memory_gb: int = 128
    memory_bytes: int = 128 * 1024 * 1024 * 1024  # 128GB
    cache_limit_bytes: int = 20 * 1024 * 1024 * 1024  # 20GB for cache
    firmware_version: str = "11881.81.2"
    os_loader_version: str = "11881.81.2"

    def __init__(self):
        self.performance_cores = max(1, multiprocessing.cpu_count() // 2)
        self.efficiency_cores = max(
            1, multiprocessing.cpu_count() - self.performance_cores
        )
        self.cache_limit_bytes = 1024 * 1024 * 1024  # 1GB default
        self.memory_limit_bytes = 1024 * 1024 * 1024 * 8  # 8GB default
        self.memory_threshold = 0.8  # 80% memory usage threshold

    def get_core_type(self, core_type: CoreType) -> int:
        """Get the number of cores for a given core type"""
        if core_type == CoreType.PERFORMANCE:
            return self.performance_cores
        elif core_type == CoreType.EFFICIENCY:
            return self.efficiency_cores
        return 0

    def get_total_cores(self) -> int:
        """Get the total number of cores"""
        return self.total_cores

    def get_memory_bytes(self) -> int:
        """Get the total memory in bytes"""
        return self.memory_bytes

    def get_cache_limit_bytes(self) -> int:
        """Get the cache limit in bytes"""
        return self.cache_limit_bytes

    def get_firmware_version(self) -> str:
        """Get the firmware version"""
        return self.firmware_version

    def get_os_loader_version(self) -> str:
        """Get the OS loader version"""
        return self.os_loader_version

    def get_config(self) -> dict:
        """Get the configuration as a dictionary"""
        return {
            "model_name": self.model_name,
            "model_identifier": self.model_identifier,
            "model_number": self.model_number,
            "chip": self.chip,
            "performance_cores": self.performance_cores,
            "efficiency_cores": self.efficiency_cores,
            "total_cores": self.total_cores,
            "memory_gb": self.memory_gb,
            "cache_limit_bytes": self.cache_limit_bytes,
            "firmware_version": self.firmware_version,
            "os_loader_version": self.os_loader_version,
        }
