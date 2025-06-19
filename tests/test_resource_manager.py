import os
import asyncio
from datetime import (
    datetime,
    timedelta,
)
from internal.resource_manager import (
    CacheManager,
    FileOperator,
    get_resource_manager,
    MemoryManager,
    MetadataManager,
    PerformanceOptimizer,
    ResourceManager,
)
from internal.system_config import M4MaxConfig
from pathlib import Path
import pytest
import tempfile


# Helper functions for tests that need to be picklable
def compute_task(x: int) -> int:
    """Test compute function that must be module-level for pickling"""
    return x**2


def cpu_task(x: int) -> int:
    """Test CPU task that must be module-level for pickling"""
    return x * 2


def io_task(x: int) -> int:
    """Test IO task that must be module-level for pickling"""
    return x + 1


async def async_delete_file(file: Path) -> None:
    """Async file deletion helper"""
    try:
        file.unlink()
    except Exception as e:
        print(f"Error deleting {file}: {e}")


@pytest.fixture
def m4_config():
    """Fixture for M4MaxConfig"""
    return M4MaxConfig()


@pytest.fixture
def temp_cache_dir():
    """Fixture for temporary cache directory"""
    with tempfile.TemporaryDirectory() as temp_dir:
        yield Path(temp_dir)


@pytest.fixture
def perf_optimizer(m4_config):
    """Fixture for PerformanceOptimizer"""
    optimizer = PerformanceOptimizer(m4_config)
    yield optimizer
    optimizer.cleanup()


@pytest.fixture
def memory_manager(m4_config):
    """Fixture for MemoryManager"""
    return MemoryManager(m4_config)


@pytest.fixture
def metadata_manager(temp_cache_dir, memory_manager):
    """Fixture for MetadataManager"""
    return MetadataManager(temp_cache_dir, memory_manager)


@pytest.fixture
def file_operator(perf_optimizer):
    """Fixture for FileOperator"""
    return FileOperator(perf_optimizer)


@pytest.fixture
def cache_manager(
    temp_cache_dir, m4_config, metadata_manager, file_operator, memory_manager
):
    """Fixture for CacheManager"""
    return CacheManager(
        temp_cache_dir,
        max_cache_age=3600,
        config=m4_config,
        metadata_manager=metadata_manager,
        file_operator=file_operator,
        memory_manager=memory_manager,
    )


@pytest.fixture
def resource_manager(temp_cache_dir):
    """Fixture for ResourceManager"""
    manager = ResourceManager(temp_cache_dir)
    yield manager
    asyncio.run(manager.cleanup())


class TestM4MaxConfig:
    """Tests for M4MaxConfig"""

    def test_config_initialization(self, m4_config):
        """Test M4MaxConfig initialization with correct values"""
        assert m4_config.model_name == "MacBook Pro"
        assert m4_config.performance_cores == 12
        assert m4_config.efficiency_cores == 4
        assert m4_config.total_cores == 16
        assert m4_config.memory_gb == 128
        assert m4_config.cache_limit_bytes == 20 * 1024 * 1024 * 1024


class TestPerformanceOptimizer:
    """Tests for PerformanceOptimizer"""

    @pytest.mark.asyncio
    async def test_run_cpu_bound(self, perf_optimizer):
        """Test CPU-bound task execution"""
        result = await perf_optimizer.run_cpu_bound(cpu_task, 5)
        assert result == 10

    @pytest.mark.asyncio
    async def test_run_io_bound(self, perf_optimizer):
        """Test IO-bound task execution"""
        result = await perf_optimizer.run_io_bound(io_task, 5)
        assert result == 6

    @pytest.mark.asyncio
    async def test_run_parallel_compute(self, perf_optimizer):
        """Test parallel compute task execution"""
        result = await perf_optimizer.run_parallel_compute(compute_task, 4)
        assert result == 16


class TestMemoryManager:
    """Tests for MemoryManager"""

    def test_cached_data_operations(self, memory_manager):
        """Test cache data operations"""
        test_key = "test_key"
        test_value = {"data": "test"}

        memory_manager.set_cached_data(test_key, test_value)
        cached = memory_manager.get_cached_data(test_key)
        assert cached == test_value

    def test_cache_limit_enforcement(self, memory_manager):
        """Test cache limit enforcement"""
        # Create data that exceeds cache limit (20GB)
        data = "x" * (1024 * 1024)  # 1MB of data
        for i in range(21 * 1024):  # Try to store 21GB
            memory_manager.set_cached_data(f"key_{i}", data)

        # Verify cache was cleared and is under limit
        total_size = sum(len(str(v)) for v in memory_manager._cached_data.values())
        assert total_size < memory_manager.config.cache_limit_bytes


class TestMetadataManager:
    """Tests for MetadataManager"""

    def test_metadata_initialization(self, metadata_manager, temp_cache_dir):
        """Test metadata initialization"""
        assert metadata_manager.metadata == {}
        assert metadata_manager.metadata_file == temp_cache_dir / "cache_metadata.json"

    @pytest.mark.asyncio
    async def test_save_and_load_metadata(self, metadata_manager):
        """Test saving and loading metadata"""
        test_data = {"test_file": {"timestamp": 123456789}}
        metadata_manager.metadata = test_data

        await metadata_manager.save_metadata_async()

        # Load metadata again
        loaded_data = metadata_manager._load_metadata()
        assert loaded_data == test_data

    def test_remove_entry(self, metadata_manager):
        """Test removing metadata entry"""
        metadata_manager.metadata = {"test_file": {"data": "test"}}
        metadata_manager.remove_entry("test_file")
        assert "test_file" not in metadata_manager.metadata


class TestFileOperator:
    """Tests for FileOperator"""

    @pytest.mark.asyncio
    async def test_parallel_operation(self, file_operator, temp_cache_dir):
        """Test parallel file operations"""
        # Create test files
        test_files = []
        for i in range(5):
            file_path = temp_cache_dir / f"test_{i}.txt"
            file_path.write_text("test")
            test_files.append(file_path)

        await file_operator.parallel_operation(test_files, async_delete_file)

        # Verify files are deleted
        for file in test_files:
            assert not file.exists()

    @pytest.mark.asyncio
    async def test_calculate_directory_size(self, file_operator, temp_cache_dir):
        """Test directory size calculation"""
        # Create test files with known sizes
        file_sizes = [100, 200, 300]
        for i, size in enumerate(file_sizes):
            file_path = temp_cache_dir / f"test_{i}.txt"
            file_path.write_text("x" * size)

        total_size = await file_operator.calculate_directory_size(
            list(temp_cache_dir.glob("*"))
        )
        assert total_size == sum(file_sizes)


class TestCacheManager:
    """Tests for CacheManager"""

    def test_ensure_cache_dir(self, cache_manager, temp_cache_dir):
        """Test cache directory creation and permissions"""
        cache_manager.ensure_cache_dir()
        assert temp_cache_dir.exists()
        assert oct(temp_cache_dir.stat().st_mode)[-3:] == "700"

    @pytest.mark.asyncio
    async def test_clear_old_caches(self, cache_manager, temp_cache_dir):
        """Test clearing old cache files"""
        # Create old and new test files
        old_file = temp_cache_dir / "old.txt"
        new_file = temp_cache_dir / "new.txt"

        old_file.write_text("old")
        new_file.write_text("new")

        # Set old file's modification time to past max_cache_age
        old_time = datetime.now() - timedelta(seconds=cache_manager.max_cache_age * 2)
        os.utime(old_file, (old_time.timestamp(), old_time.timestamp()))

        await cache_manager.clear_old_caches()

        # Verify files
        assert not old_file.exists()
        assert new_file.exists()

    @pytest.mark.asyncio
    async def test_optimize_cache(self, cache_manager, temp_cache_dir):
        """Test cache optimization"""
        # Create test files exceeding cache limit
        total_size = cache_manager.config.cache_limit_bytes + 1024
        test_file = temp_cache_dir / "large_file.txt"
        test_file.write_text("x" * total_size)

        await cache_manager.optimize_cache()

        # Wait a bit for file operations to complete
        await asyncio.sleep(0.1)

        # Verify cache size is reduced
        current_size = await cache_manager.get_cache_size()
        assert current_size <= cache_manager.config.cache_limit_bytes


class TestResourceManager:
    """Tests for ResourceManager"""

    def test_initialization(self, resource_manager, temp_cache_dir):
        """Test ResourceManager initialization"""
        assert isinstance(resource_manager.config, M4MaxConfig)
        assert isinstance(resource_manager.perf_optimizer, PerformanceOptimizer)
        assert isinstance(resource_manager.memory_manager, MemoryManager)
        assert isinstance(resource_manager.metadata_manager, MetadataManager)
        assert isinstance(resource_manager.file_operator, FileOperator)
        assert isinstance(resource_manager.cache_manager, CacheManager)

    @pytest.mark.asyncio
    async def test_cleanup(self, resource_manager, temp_cache_dir):
        """Test cleanup operation"""
        # Create test file
        test_file = temp_cache_dir / "test.txt"
        test_file.write_text("test")

        await resource_manager.cleanup()

        # Wait a bit for file operations to complete
        await asyncio.sleep(0.1)

        # Verify cleanup operations
        assert temp_cache_dir.exists()
        assert oct(temp_cache_dir.stat().st_mode)[-3:] == "700"


def test_get_resource_manager(temp_cache_dir) -> None:
    """Test resource manager factory function"""
    manager = get_resource_manager(temp_cache_dir)
    assert isinstance(manager, ResourceManager)
    assert manager.cache_dir == temp_cache_dir
