#!/usr/bin/env python3
"""Check if environment is ready for backend testing."""

import sys
import subprocess

def check_python_version():
    """Check Python version."""
    version = sys.version_info
    print(f"Python version: {version.major}.{version.minor}.{version.micro}")

    if version.major == 3 and version.minor >= 10:
        print("✅ Python version OK (3.10+)")
        return True
    else:
        print("❌ Python 3.10+ required")
        return False


def check_package(package_name, import_name=None):
    """Check if a package can be imported."""
    if import_name is None:
        import_name = package_name

    try:
        __import__(import_name)
        print(f"✅ {package_name} installed")
        return True
    except ImportError:
        print(f"❌ {package_name} NOT installed")
        return False


def main():
    """Run all checks."""
    print("=" * 50)
    print("Backend Environment Check")
    print("=" * 50)
    print()

    checks = []

    # Python version
    checks.append(check_python_version())
    print()

    # Required packages
    print("Checking required packages...")
    packages = [
        ("FastAPI", "fastapi"),
        ("Uvicorn", "uvicorn"),
        ("Pydantic", "pydantic"),
        ("Pandas", "pandas"),
        ("Polars", "polars"),
        ("PyArrow", "pyarrow"),
        ("NumPy", "numpy"),
        ("SciPy", "scipy"),
        ("PyMC", "pymc"),
        ("ArviZ", "arviz"),
        ("Multipart", "multipart"),
        ("AioFiles", "aiofiles"),
    ]

    for name, import_name in packages:
        checks.append(check_package(name, import_name))

    print()
    print("=" * 50)

    if all(checks):
        print("✅ ALL CHECKS PASSED! You're ready to start the server.")
        print()
        print("Next steps:")
        print("  python3 app.py")
        return 0
    else:
        print("❌ SOME CHECKS FAILED!")
        print()
        print("To fix:")
        print("  pip install -r requirements.txt")
        print()
        print("Or see SETUP_AND_TEST.md for detailed instructions.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
