import pytest
from security_scanner import SecurityScanner


@pytest.fixture
def scanner():
    return SecurityScanner()


def test_scanner_initialization(scanner) -> None:
    assert scanner is not None
    assert hasattr(scanner, "findings")
    assert isinstance(scanner.findings, list)


def test_entropy_calculation(scanner):
    # Test entropy calculation with known values
    assert scanner.calculate_entropy("") == 0
    assert scanner.calculate_entropy("aaaa") < 1.0  # Low entropy for repeated chars
    assert (
        scanner.calculate_entropy("abcdefgh") > 2.5
    )  # Higher entropy for varied chars


def test_is_text_file(scanner, tmp_path) -> None:
    # Create test files
    text_file = tmp_path / "test.txt"
    text_file.write_text("This is a test file")

    binary_file = tmp_path / "test.bin"
    binary_file.write_bytes(b"\x00\x01\x02\x03")

    assert scanner.is_text_file(text_file)
    assert not scanner.is_text_file(binary_file)


def test_pattern_matching(scanner, tmp_path):
    # Create a test file with a fake API key
    test_file = tmp_path / "config.py"
    test_file.write_text('api_key = "abc123def456"')

    scanner.scan_file(test_file)
    assert len(scanner.findings) > 0
    assert any("api_key" in finding["type"] for finding in scanner.findings)


def test_high_entropy_detection(scanner) -> None:
    # Test high entropy string detection
    low_entropy = "aaaaaaaaaa"
    high_entropy = "aB3$x9#mK!"

    assert not scanner.is_high_entropy(low_entropy)
    assert scanner.is_high_entropy(high_entropy)
