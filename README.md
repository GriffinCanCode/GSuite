# Custom Tools Collection

The GSUITE repo - A comprehensive collection of development tools and utilities for enhanced productivity.

## 🚀 Overview

This repository contains a curated collection of powerful development tools designed to streamline workflows, improve code quality, and enhance productivity. Each tool is maintained as a separate submodule, allowing for independent development and updates.

## 📦 Repository Structure

### Git Submodules
This repository contains the following submodules:

- **[qgit](https://github.com/GriffinCanCode/QGit)** - Git workflow automation tool with advanced branching and merge capabilities
- **[qvenv](https://github.com/GriffinCanCode/QVenv)** - Quick Python virtual environment manager with automatic requirements detection
- **[generate](https://github.com/GriffinCanCode/Generator)** - Project template generator with Docker, ESLint, and modern development stack support
- **[desktidy](https://github.com/GriffinCanCode/Desktidy)** - Desktop organization and cleanup utility for maintaining a clean workspace
- **[FaxMachine](https://github.com/GriffinCanCode/FaxMachine)** - Documentation and template management system with MDC support
- **[exporters](https://github.com/GriffinCanCode/Exporters)** - Comprehensive code quality and documentation tool suite with multi-language formatting

## 🛠️ Tools Overview

### 📊 Exporters - Code Quality & Documentation Suite
**Location**: `exporters/`  
**Command**: `exporter`

A comprehensive tool for code quality management and documentation generation:

- **Code Quality Tools**: Black, isort, Ruff, MyPy, Bandit
- **Multi-language Formatting**: Python, JavaScript, TypeScript, Go, Rust, C/C++, and more
- **Documentation Generation**: Sphinx with modern themes and extensions
- **Interactive UI**: Rich terminal interface with progress indicators
- **Globaltools Integration**: Automatic tool installation and management

```bash
# Interactive mode
exporter

# Direct formatting
exporter format . --no-recursive
exporter format /path/to/project --report
```

### 🔄 QGit - Git Workflow Automation
**Location**: `qgit/`  
**Command**: `qgit`

Advanced Git workflow automation with intelligent branching and merge capabilities:

- Automated branch management
- Smart merge conflict resolution
- Workflow templates and patterns
- Git history analysis and optimization

### 🏗️ Generate - Project Template Generator
**Location**: `generate/`  
**Command**: `generate`

Modern project scaffolding with best practices built-in:

- Multiple project templates (React, Node.js, Python, etc.)
- Docker configuration generation
- ESLint and code quality setup
- CI/CD pipeline templates
- Environment configuration management

### 🧹 Desktidy - Desktop Organization
**Location**: `desktidy/`  
**Command**: `desktidy`

Intelligent desktop cleanup and organization utility:

- Automated file organization by type and date
- Duplicate file detection and removal
- Customizable organization rules
- Safe cleanup with backup options

### 📋 FaxMachine - Documentation & Templates
**Location**: `FaxMachine/`  
**Command**: `faxmachine`

Documentation and template management system:

- MDC (Markdown Documentation) support
- Template library management
- Documentation generation and maintenance
- Cross-project template sharing

### 🐍 QVenv - Quick Python Virtual Environment Manager
**Location**: `qvenv/`  
**Command**: `qvenv`

Efficient Python virtual environment creation and management:

- **Automatic Python Detection**: Finds the latest stable Python version
- **Smart Requirements Installation**: Auto-detects and installs from requirements files
- **Cross-Platform Support**: Works on Windows, macOS, and Linux
- **Global Installation**: Easy symlink creation for system-wide access
- **Force Recreation**: Option to recreate existing environments
- **Comprehensive Logging**: Timestamped output for debugging

```bash
# Quick environment setup
qvenv my_project

# Complete setup with requirements
qvenv --complete --force production_env

# Global installation
qvenv --install
```

## 🚀 Quick Start

### Prerequisites
- Python 3.9 or higher
- Git with submodule support
- Virtual environment (recommended)

### Installation

1. **Clone the repository with submodules**:
```bash
git clone --recursive https://github.com/GriffinCanCode/GSuite.git
cd GSuite
```

2. **Initialize submodules** (if not cloned recursively):
```bash
git submodule update --init --recursive
```

3. **Set up individual tools**:
```bash
# Install exporters dependencies
cd exporters
pip install -r requirements.txt
cd ..

# Set up other tools as needed
# Each submodule has its own installation instructions
```

### Global Command Setup

The repository includes wrapper scripts for global access to tools:

```bash
# Make sure /usr/local/bin is in your PATH
# The exporter command is already set up via symlink

# Test the exporter
exporter --help
```

## 📁 Directory Structure

```
custom/
├── README.md                    # This file
├── .gitmodules                  # Submodule configuration
├── exporter_wrapper             # Global exporter wrapper script
├── qgit/                        # Git workflow automation
├── generate/                    # Project template generator
├── desktidy/                    # Desktop organization utility
├── FaxMachine/                  # Documentation & template management
├── exporters/                   # Code quality & documentation suite
├── qvenv/                       # Python virtual environment manager
├── services/                    # System services and daemons
├── CursorRules/                 # Cursor AI rules and configurations
├── cheatsheets/                 # Development cheatsheets and references
├── converters/                  # File format conversion utilities
├── internal/                    # Shared internal utilities
├── tests/                       # Test suites
└── docs/                        # Documentation
```

## 🔧 Configuration

### Global Configuration
Some tools share configuration through the `internal/` directory:
- Resource management utilities
- Shared environment loading
- Common configuration patterns

### Tool-Specific Configuration
Each tool maintains its own configuration:
- `exporters/pyproject.toml` - Code quality tool settings
- `qgit/config/` - Git workflow configurations
- `generate/templates/` - Project templates
- `desktidy/config/` - Organization rules
- `FaxMachine/templates/` - Documentation templates

## 🤝 Contributing

Each tool is maintained as a separate repository. To contribute:

1. Fork the specific tool's repository
2. Create a feature branch
3. Make your changes with tests
4. Submit a pull request to the tool's repository

For changes to this main collection:
1. Fork this repository
2. Update submodule references if needed
3. Submit a pull request

## 📚 Documentation

- **Individual Tool Docs**: Each submodule contains its own README and documentation
- **Cheatsheets**: Quick reference guides in `cheatsheets/`
- **Cursor Rules**: AI-assisted development rules in `CursorRules/`
- **Examples**: Usage examples and templates throughout the repository

## 🔗 Links

- [Main Repository](https://github.com/GriffinCanCode/GSuite)
- [QGit](https://github.com/GriffinCanCode/QGit)
- [QVenv](https://github.com/GriffinCanCode/QVenv)
- [Generator](https://github.com/GriffinCanCode/Generator)
- [Desktidy](https://github.com/GriffinCanCode/Desktidy)
- [FaxMachine](https://github.com/GriffinCanCode/FaxMachine)
- [Exporters](https://github.com/GriffinCanCode/Exporters)

## 📄 License

This project and its submodules are licensed under the MIT License - see the individual LICENSE files for details.

## 🆘 Support

For issues and questions:
- Check the specific tool's repository for tool-specific issues
- Create an issue in this repository for collection-wide concerns
- Review the documentation in the `docs/` directory
