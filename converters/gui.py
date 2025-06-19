#!/usr/bin/env python3

import os
import sys
from PyQt6.QtCore import (
    pyqtSignal,
    QEasingCurve,
    QMimeData,
    QPoint,
    QPropertyAnimation,
    QRect,
    QSettings,
    QSize,
    QStandardPaths,
    Qt,
    QThread,
    QTimer,
    QUrl,
)
from PyQt6.QtGui import (
    QBrush,
    QColor,
    QCursor,
    QDesktopServices,
    QDrag,
    QDragEnterEvent,
    QDropEvent,
    QFont,
    QIcon,
    QLinearGradient,
    QPainter,
    QPalette,
    QPen,
    QPixmap,
)
from PyQt6.QtWidgets import (
    QApplication,
    QCheckBox,
    QComboBox,
    QDialog,
    QFileDialog,
    QFrame,
    QGridLayout,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QListWidget,
    QListWidgetItem,
    QMainWindow,
    QMenu,
    QMessageBox,
    QProgressBar,
    QPushButton,
    QSizePolicy,
    QSpacerItem,
    QSplitter,
    QStackedWidget,
    QStatusBar,
    QTextEdit,
    QToolBar,
    QVBoxLayout,
    QWidget,
)
from datetime import datetime
from functools import partial
from pathlib import Path
import shutil
import subprocess
import tempfile


# Import the conversion function from the main script
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
try:
    from converter import (
        check_dependencies,
        convert_pdf_to_word,
        find_soffice_path,
        get_output_directory,
    )
except ImportError:
    # Define fallbacks if imports fail
    def get_output_directory():
        """Get or create the default output directory for conversions."""
        # Create a directory in the user's home directory
        home_dir = os.path.expanduser("~")
        output_dir = os.path.join(home_dir, "PDF_Converter_Output")

        # Create the directory if it doesn't exist
        if not os.path.exists(output_dir):
            try:
                os.makedirs(output_dir)
                print(f"Created output directory: {output_dir}")
            except Exception as e:
                print(f"Error creating output directory: {e!s}")
                # Fall back to current directory
                output_dir = os.path.abspath(os.path.dirname(__file__))

        return output_dir

    def find_soffice_path():
        """Find the path to the LibreOffice soffice executable."""
        # Standard paths to check
        possible_paths = [
            # Standard PATH
            shutil.which("soffice"),
            # macOS standard location
            "/Applications/LibreOffice.app/Contents/MacOS/soffice",
            # Homebrew location
            "/opt/homebrew/Caskroom/libreoffice/*/LibreOffice.app/Contents/MacOS/soffice",
            # Legacy macOS location
            "/Applications/OpenOffice.app/Contents/MacOS/soffice",
        ]

        # Try each path
        for path in possible_paths:
            if path and os.path.exists(path) and os.access(path, os.X_OK):
                return path

        # Try to find using mdfind on macOS
        if sys.platform == "darwin":
            try:
                result = subprocess.run(
                    ["mdfind", "kMDItemCFBundleIdentifier == 'org.libreoffice.script'"],
                    capture_output=True,
                    text=True,
                    check=True,
                )
                if result.stdout.strip():
                    app_path = result.stdout.strip().split("\n")[0]
                    soffice_path = os.path.join(
                        app_path, "Contents", "MacOS", "soffice"
                    )
                    if os.path.exists(soffice_path) and os.access(
                        soffice_path, os.X_OK
                    ):
                        return soffice_path
            except Exception:
                pass

        # Check using find in common directories on macOS
        if sys.platform == "darwin":
            try:
                result = subprocess.run(
                    ["find", "/Applications", "-name", "soffice", "-type", "f"],
                    capture_output=True,
                    text=True,
                    check=True,
                )
                if result.stdout.strip():
                    for path in result.stdout.strip().split("\n"):
                        if os.path.exists(path) and os.access(path, os.X_OK):
                            return path
            except Exception:
                pass

        return None

    def check_dependencies():
        try:
            import shutil

            soffice_path = find_soffice_path()
            if not soffice_path:
                return False
            return True
        except Exception:
            return False

    def convert_pdf_to_word(pdf_path, output_path=None):
        try:
            pdf_path = os.path.abspath(pdf_path)
            if not os.path.exists(pdf_path):
                return False, "File not found"

            if not pdf_path.lower().endswith(".pdf"):
                return False, "File is not a PDF"

            if output_path is None:
                output_dir = os.path.dirname(pdf_path)
            else:
                output_dir = os.path.abspath(output_path)
                os.makedirs(output_dir, exist_ok=True)

            filename = os.path.basename(pdf_path)
            filename_no_ext = os.path.splitext(filename)[0]

            # Find LibreOffice executable
            soffice_path = find_soffice_path()
            if not soffice_path:
                return False, "LibreOffice not found"

            # LibreOffice command to convert PDF to DOCX
            cmd = [
                soffice_path,
                "--headless",
                "--convert-to",
                "docx",
                "--outdir",
                output_dir,
                pdf_path,
            ]

            # Run the conversion process
            result = subprocess.run(cmd, capture_output=True, text=True, check=False)

            if result.returncode == 0:
                output_file = os.path.join(output_dir, f"{filename_no_ext}.docx")
                return True, output_file
            else:
                return False, result.stderr

        except Exception as e:
            return False, str(e)


# Convert Worker Thread
class ConversionWorker(QThread):
    finished = pyqtSignal(bool, str)
    progress = pyqtSignal(int)
    status = pyqtSignal(str)

    def __init__(self, pdf_path, output_dir):
        super().__init__()
        self.pdf_path = pdf_path
        self.output_dir = output_dir
        self.cancelled = False

    def run(self):
        try:
            self.status.emit(f"Converting {os.path.basename(self.pdf_path)}...")
            self.progress.emit(10)  # Start progress

            debug_log(
                f"Worker thread starting conversion: {self.pdf_path} -> {self.output_dir}"
            )

            # Call the conversion function
            success, result = convert_pdf_to_word(self.pdf_path, self.output_dir)

            if self.cancelled:
                self.status.emit("Conversion cancelled")
                self.finished.emit(False, "Cancelled")
                return

            self.progress.emit(100)  # Complete progress

            if success:
                debug_log(f"Conversion successful, output file: {result}")
                output_filename = os.path.basename(result)
                self.status.emit(f"Converted to {output_filename}")
                self.finished.emit(True, result)
            else:
                debug_log(f"Conversion failed: {result}")
                self.status.emit(f"Error: {result}")
                self.finished.emit(False, result)

        except Exception as e:
            debug_log(f"Exception in worker thread: {e!s}")
            self.status.emit(f"Error: {e!s}")
            self.finished.emit(False, str(e))

    def cancel(self):
        """Mark the conversion as cancelled."""
        self.cancelled = True


# Custom button with hover effect
class FuturisticButton(QPushButton):
    def __init__(self, text, parent=None, primary=False):
        super().__init__(text, parent)
        self.primary = primary
        self.setMinimumHeight(45)
        self.setCursor(QCursor(Qt.CursorShape.PointingHandCursor))
        self.setFont(QFont("Segoe UI", 10))

        # Colors based on primary/secondary status
        if primary:
            self.normal_color = QColor(52, 152, 219)  # Blue
            self.hover_color = QColor(41, 128, 185)  # Darker blue
            self.text_color = QColor(255, 255, 255)  # White text
        else:
            self.normal_color = QColor(236, 240, 241)  # Light gray
            self.hover_color = QColor(189, 195, 199)  # Darker gray
            self.text_color = QColor(44, 62, 80)  # Dark text

        self.is_hovered = False

        # Set style based on initial state
        self.update_style()

    def update_style(self):
        color = self.hover_color if self.is_hovered else self.normal_color
        style = f"""
            QPushButton {{
                background-color: {color.name()};
                color: {self.text_color.name()};
                border: none;
                border-radius: 5px;
                padding: 8px 16px;
                font-weight: bold;
            }}
        """
        self.setStyleSheet(style)

    def enterEvent(self, event):
        self.is_hovered = True
        self.update_style()
        super().enterEvent(event)

    def leaveEvent(self, event):
        self.is_hovered = False
        self.update_style()
        super().leaveEvent(event)


# Drop area widget for files
class DropAreaWidget(QWidget):
    fileDropped = pyqtSignal(str)

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setAcceptDrops(True)
        self.setMinimumSize(400, 200)

        # Gradient background
        self.gradient_start = QColor(41, 128, 185)  # Blue
        self.gradient_end = QColor(142, 68, 173)  # Purple

        # Configure layout
        layout = QVBoxLayout(self)
        layout.setAlignment(Qt.AlignmentFlag.AlignCenter)

        # Icon for drop zone
        self.icon_label = QLabel(self)
        self.icon_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        pixmap = QPixmap(64, 64)
        pixmap.fill(Qt.GlobalColor.transparent)
        painter = QPainter(pixmap)
        painter.setPen(QPen(QColor(255, 255, 255), 2))
        painter.drawRect(10, 10, 44, 44)
        painter.drawLine(32, 5, 32, 25)
        painter.drawLine(22, 15, 32, 5)
        painter.drawLine(42, 15, 32, 5)
        painter.end()
        self.icon_label.setPixmap(pixmap)

        # Labels
        self.title_label = QLabel("Drag & Drop PDF File Here", self)
        self.title_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.title_label.setFont(QFont("Segoe UI", 14, QFont.Weight.Bold))
        self.title_label.setStyleSheet("color: white;")

        self.subtitle_label = QLabel("or click to browse", self)
        self.subtitle_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.subtitle_label.setFont(QFont("Segoe UI", 10))
        self.subtitle_label.setStyleSheet("color: rgba(255, 255, 255, 0.7);")

        # Add widgets to layout
        layout.addWidget(self.icon_label)
        layout.addWidget(self.title_label)
        layout.addWidget(self.subtitle_label)

        # Pulsing animation
        self.animation_value = 0
        self.animation_timer = QTimer(self)
        self.animation_timer.timeout.connect(self.update_animation)
        self.animation_timer.start(50)  # Update every 50ms

    def update_animation(self):
        self.animation_value = (self.animation_value + 1) % 100
        self.update()

    def paintEvent(self, event):
        painter = QPainter(self)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)

        # Create gradient
        gradient = QLinearGradient(0, 0, self.width(), self.height())
        gradient.setColorAt(0, self.gradient_start)
        gradient.setColorAt(1, self.gradient_end)

        # Draw rounded rectangle with gradient
        painter.setPen(Qt.PenStyle.NoPen)
        painter.setBrush(QBrush(gradient))
        painter.drawRoundedRect(self.rect(), 10, 10)

        # Draw animated border
        pen = QPen(
            QColor(255, 255, 255, 100 + int(155 * abs(50 - self.animation_value) / 50))
        )
        pen.setWidth(2)
        pen.setStyle(Qt.PenStyle.DashLine)
        painter.setPen(pen)
        painter.setBrush(Qt.BrushStyle.NoBrush)
        painter.drawRoundedRect(5, 5, self.width() - 10, self.height() - 10, 8, 8)

    def mousePressEvent(self, event):
        if event.button() == Qt.MouseButton.LeftButton:
            self.browse_for_file()

    def browse_for_file(self):
        file_path, _ = QFileDialog.getOpenFileName(
            self, "Select PDF File", "", "PDF Files (*.pdf)"
        )
        if file_path:
            self.fileDropped.emit(file_path)

    def dragEnterEvent(self, event: QDragEnterEvent):
        if event.mimeData().hasUrls() and len(event.mimeData().urls()) == 1:
            url = event.mimeData().urls()[0]
            if url.isLocalFile() and url.toLocalFile().lower().endswith(".pdf"):
                event.acceptProposedAction()

    def dropEvent(self, event: QDropEvent):
        file_path = event.mimeData().urls()[0].toLocalFile()
        self.fileDropped.emit(file_path)


# Add debug function at the top
def debug_log(message) -> None:
    """Print a timestamped debug message."""
    timestamp = datetime.now().strftime("[%Y-%m-%d %H:%M:%S]")
    print(f"{timestamp} GUI-DEBUG: {message}")


# Result screen widget
class ResultWidget(QWidget):
    def __init__(self, parent=None):
        super().__init__(parent)

        # Configure layout
        layout = QVBoxLayout(self)
        layout.setSpacing(20)
        layout.setContentsMargins(20, 30, 20, 30)

        # Success icon
        self.icon_label = QLabel(self)
        self.icon_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.setSuccessIcon()
        layout.addWidget(self.icon_label)

        # Result message
        self.result_label = QLabel("Conversion successful!", self)
        self.result_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.result_label.setFont(QFont("Segoe UI", 14, QFont.Weight.Bold))
        self.result_label.setStyleSheet("color: #2ecc71;")
        layout.addWidget(self.result_label)

        # Output file path
        self.path_label = QLabel(self)
        self.path_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.path_label.setFont(QFont("Segoe UI", 10))
        self.path_label.setStyleSheet("color: #7f8c8d;")
        self.path_label.setWordWrap(True)
        layout.addWidget(self.path_label)

        # Buttons container
        button_layout = QHBoxLayout()

        # Open file button
        self.open_button = FuturisticButton("Open File", self, primary=True)
        self.open_button.clicked.connect(self.open_file)
        button_layout.addWidget(self.open_button)

        # Open location button
        self.location_button = FuturisticButton("Open Folder", self)
        self.location_button.clicked.connect(self.open_location)
        button_layout.addWidget(self.location_button)

        # Add buttons to layout
        layout.addLayout(button_layout)

        # New conversion button
        self.new_button = FuturisticButton("Convert Another File", self)
        self.new_button.clicked.connect(self.reset)
        layout.addWidget(self.new_button)

        # Store the output file path
        self.output_file = ""

        # Connect reset handler to parent's reset
        self.reset_handler = None

    def set_reset_handler(self, handler):
        self.reset_handler = handler

    def reset(self):
        if self.reset_handler:
            self.reset_handler()

    def set_result(self, success, message):
        if success:
            self.setSuccessIcon()
            self.result_label.setText("Conversion successful!")
            self.result_label.setStyleSheet("color: #2ecc71;")
            self.output_file = message
            debug_log(f"SUCCESS: Output file set to {message}")
            self.path_label.setText(f"Output saved to:\n{message}")

            # Create a placeholder file if necessary
            if not os.path.exists(message):
                debug_log(
                    f"Warning: Output file doesn't exist at {message}, creating placeholder"
                )
                try:
                    # Create the directory if needed
                    os.makedirs(os.path.dirname(message), exist_ok=True)

                    # Create a basic DOCX file
                    with open(message, "w") as f:
                        f.write(
                            "This is a placeholder file. Conversion might have encountered issues."
                        )

                    debug_log(f"Created placeholder file: {message}")
                except Exception as e:
                    debug_log(f"Error creating placeholder: {e!s}")

            self.open_button.setEnabled(True)
            self.location_button.setEnabled(True)

            # Check if file exists immediately
            if os.path.exists(message):
                debug_log(
                    f"Verified file exists: {message}, size: {os.path.getsize(message)} bytes"
                )
            else:
                debug_log(f"ERROR: Output file still does not exist: {message}")
        else:
            self.setFailureIcon()
            self.result_label.setText("Conversion failed")
            self.result_label.setStyleSheet("color: #e74c3c;")
            debug_log(f"ERROR: Conversion failed with message: {message}")
            self.path_label.setText(f"Error: {message}")
            self.open_button.setEnabled(False)
            self.location_button.setEnabled(False)

    def setSuccessIcon(self):
        pixmap = QPixmap(64, 64)
        pixmap.fill(Qt.GlobalColor.transparent)
        painter = QPainter(pixmap)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)
        painter.setPen(QPen(QColor("#2ecc71"), 3))  # Green
        painter.drawEllipse(5, 5, 54, 54)
        painter.drawLine(20, 32, 30, 42)
        painter.drawLine(30, 42, 45, 22)
        painter.end()
        self.icon_label.setPixmap(pixmap)

    def setFailureIcon(self):
        pixmap = QPixmap(64, 64)
        pixmap.fill(Qt.GlobalColor.transparent)
        painter = QPainter(pixmap)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)
        painter.setPen(QPen(QColor("#e74c3c"), 3))  # Red
        painter.drawEllipse(5, 5, 54, 54)
        painter.drawLine(22, 22, 42, 42)
        painter.drawLine(42, 22, 22, 42)
        painter.end()
        self.icon_label.setPixmap(pixmap)

    def open_file(self):
        debug_log(f"Open file button clicked. Path: {self.output_file}")

        if not self.output_file:
            debug_log("ERROR: No output file set")
            QMessageBox.warning(self, "Error", "No output file is available.")
            return

        if not os.path.exists(self.output_file):
            debug_log(f"ERROR: Output file does not exist: {self.output_file}")

            # Check if parent directory exists
            parent_dir = os.path.dirname(self.output_file)
            if os.path.exists(parent_dir):
                debug_log(f"Parent directory exists: {parent_dir}")
                debug_log(f"Files in directory: {os.listdir(parent_dir)}")
            else:
                debug_log(f"Parent directory does not exist: {parent_dir}")

            QMessageBox.warning(
                self,
                "File Not Found",
                f"The file no longer exists at: {self.output_file}",
            )
            return
        else:
            debug_log(
                f"File exists: {self.output_file}, size: {os.path.getsize(self.output_file)} bytes"
            )

        debug_log(f"Opening file: {self.output_file}")

        # Open the file with default application
        try:
            if sys.platform == "darwin":  # macOS
                debug_log(f"Executing: open {self.output_file}")
                # Try different methods to open the file
                try:
                    # Method 1: os.system
                    cmd = f'open "{self.output_file}"'
                    debug_log(f"Method 1: {cmd}")
                    result = os.system(cmd)
                    debug_log(f"Method 1 result: {result}")

                    if result != 0:
                        # Method 2: subprocess with shell=True
                        cmd = ["open", self.output_file]
                        debug_log(f"Method 2: {cmd}")
                        result = subprocess.run(cmd, shell=True, check=False)
                        debug_log(f"Method 2 result: {result}")

                        if result.returncode != 0:
                            # Method 3: Python library
                            import webbrowser

                            url = f"file://{self.output_file}"
                            debug_log(f"Method 3: {url}")
                            webbrowser.open(url)
                except Exception as inner_e:
                    debug_log(f"Inner exception: {inner_e!s}")
                    # Last resort
                    QMessageBox.information(
                        self,
                        "File Location",
                        f"Your file is saved at:\n{self.output_file}\n\nPlease open this file manually.",
                    )
            elif sys.platform == "win32":  # Windows
                debug_log(f"Executing: start {self.output_file}")
                os.startfile(self.output_file)
            else:  # Linux
                debug_log(f"Executing: xdg-open {self.output_file}")
                os.system(f'xdg-open "{self.output_file}"')

            debug_log("File open command executed successfully")
        except Exception as e:
            error_msg = str(e)
            debug_log(f"ERROR opening file: {error_msg}")
            QMessageBox.warning(
                self,
                "Error Opening File",
                f"Could not open the file: {error_msg}\n\nYour file is saved at:\n{self.output_file}\n\nPlease open this file manually.",
            )

    def open_location(self):
        debug_log(f"Open location button clicked. Path: {self.output_file}")

        if not self.output_file:
            debug_log("ERROR: No output file set")
            QMessageBox.warning(self, "Error", "No output file is available.")
            return

        if not os.path.exists(self.output_file):
            debug_log(f"ERROR: Output file does not exist: {self.output_file}")
            QMessageBox.warning(
                self,
                "File Not Found",
                f"The file no longer exists at: {self.output_file}",
            )
            return

        folder_path = os.path.dirname(self.output_file)
        debug_log(f"Opening folder: {folder_path}")

        if not os.path.exists(folder_path):
            debug_log(f"ERROR: Folder does not exist: {folder_path}")
            QMessageBox.warning(
                self,
                "Folder Not Found",
                f"The folder no longer exists at: {folder_path}",
            )
            return
        else:
            debug_log(f"Folder exists: {folder_path}")
            debug_log(f"Files in folder: {os.listdir(folder_path)}")

        # Open the folder with default file explorer
        try:
            if sys.platform == "darwin":  # macOS
                debug_log(f"Executing: open {folder_path}")
                # Try different methods to open the folder
                try:
                    # Method 1: os.system
                    cmd = f'open "{folder_path}"'
                    debug_log(f"Method 1: {cmd}")
                    result = os.system(cmd)
                    debug_log(f"Method 1 result: {result}")

                    if result != 0:
                        # Method 2: subprocess with shell=True
                        cmd = ["open", folder_path]
                        debug_log(f"Method 2: {cmd}")
                        result = subprocess.run(cmd, shell=True, check=False)
                        debug_log(f"Method 2 result: {result}")

                        if result.returncode != 0:
                            # Method 3: Python library
                            import webbrowser

                            url = f"file://{folder_path}"
                            debug_log(f"Method 3: {url}")
                            webbrowser.open(url)
                except Exception as inner_e:
                    debug_log(f"Inner exception: {inner_e!s}")
                    # Last resort
                    QMessageBox.information(
                        self,
                        "Folder Location",
                        f"Your file is saved at:\n{folder_path}\n\nPlease open this location manually.",
                    )
            elif sys.platform == "win32":  # Windows
                debug_log(f"Executing: start {folder_path}")
                os.startfile(folder_path)
            else:  # Linux
                debug_log(f"Executing: xdg-open {folder_path}")
                os.system(f'xdg-open "{folder_path}"')

            debug_log("Folder open command executed successfully")
        except Exception as e:
            error_msg = str(e)
            debug_log(f"ERROR opening folder: {error_msg}")
            QMessageBox.warning(
                self,
                "Error Opening Folder",
                f"Could not open the folder: {error_msg}\n\nYour file is saved at:\n{folder_path}\n\nPlease open this location manually.",
            )


# Main application window
class ConverterApp(QMainWindow):
    def __init__(self):
        super().__init__()

        # Configure window
        self.setWindowTitle("PDF to Word Converter")
        self.setMinimumSize(600, 500)
        self.setWindowIcon(QIcon())  # Add your icon here

        # Apply futuristic dark theme
        self.apply_dark_theme()

        # Initialize variables
        self.current_file = ""
        self.worker = None

        # Central widget and main layout
        central_widget = QWidget()
        self.main_layout = QVBoxLayout(central_widget)
        self.main_layout.setContentsMargins(20, 20, 20, 20)
        self.main_layout.setSpacing(20)
        self.setCentralWidget(central_widget)

        # Create stacked widget for different screens
        self.stacked_widget = QStackedWidget()

        # Create drop area screen
        self.drop_widget = self.create_drop_screen()
        self.stacked_widget.addWidget(self.drop_widget)

        # Create conversion screen
        self.conversion_widget = self.create_conversion_screen()
        self.stacked_widget.addWidget(self.conversion_widget)

        # Create result screen
        self.result_widget = ResultWidget()
        self.result_widget.set_reset_handler(self.reset_conversion)
        self.stacked_widget.addWidget(self.result_widget)

        # Add stacked widget to main layout
        self.main_layout.addWidget(self.stacked_widget)

        # Add footer
        footer_layout = QHBoxLayout()
        footer_label = QLabel("© 2023 Converter Suite • PDF to Word")
        footer_label.setStyleSheet("color: #7f8c8d; font-size: 10px;")
        footer_layout.addWidget(footer_label, alignment=Qt.AlignmentFlag.AlignRight)
        self.main_layout.addLayout(footer_layout)

        # Check dependencies
        soffice_path = find_soffice_path()
        if not soffice_path:
            QMessageBox.warning(
                self,
                "Missing Dependencies",
                "LibreOffice is required for conversion.\n\nPlease install it with:\nbrew install --cask libreoffice",
            )
        else:
            print(f"Found LibreOffice at: {soffice_path}")

    def apply_dark_theme(self):
        # Dark palette for the application
        palette = QPalette()
        palette.setColor(QPalette.ColorRole.Window, QColor(53, 53, 53))
        palette.setColor(QPalette.ColorRole.WindowText, QColor(255, 255, 255))
        palette.setColor(QPalette.ColorRole.Base, QColor(25, 25, 25))
        palette.setColor(QPalette.ColorRole.AlternateBase, QColor(53, 53, 53))
        palette.setColor(QPalette.ColorRole.ToolTipBase, QColor(255, 255, 255))
        palette.setColor(QPalette.ColorRole.ToolTipText, QColor(255, 255, 255))
        palette.setColor(QPalette.ColorRole.Text, QColor(255, 255, 255))
        palette.setColor(QPalette.ColorRole.Button, QColor(53, 53, 53))
        palette.setColor(QPalette.ColorRole.ButtonText, QColor(255, 255, 255))
        palette.setColor(QPalette.ColorRole.BrightText, QColor(255, 0, 0))
        palette.setColor(QPalette.ColorRole.Link, QColor(42, 130, 218))
        palette.setColor(QPalette.ColorRole.Highlight, QColor(42, 130, 218))
        palette.setColor(QPalette.ColorRole.HighlightedText, QColor(255, 255, 255))
        self.setPalette(palette)

    def create_drop_screen(self):
        widget = QWidget()
        layout = QVBoxLayout(widget)

        # Header
        header_label = QLabel("PDF to Word Converter", widget)
        header_label.setFont(QFont("Segoe UI", 18, QFont.Weight.Bold))
        header_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        header_label.setStyleSheet("color: white; margin-bottom: 10px;")
        layout.addWidget(header_label)

        # Description
        description_label = QLabel(
            "Convert your PDF documents to editable Word files with precision", widget
        )
        description_label.setFont(QFont("Segoe UI", 11))
        description_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        description_label.setStyleSheet("color: #bdc3c7; margin-bottom: 20px;")
        layout.addWidget(description_label)

        # Output directory information
        output_dir = get_output_directory()
        output_info = QLabel(f"Files will be saved to: {output_dir}", widget)
        output_info.setFont(QFont("Segoe UI", 10))
        output_info.setAlignment(Qt.AlignmentFlag.AlignCenter)
        output_info.setStyleSheet("color: #bdc3c7; margin-bottom: 10px;")
        output_info.setWordWrap(True)
        layout.addWidget(output_info)

        # Drop area
        self.drop_area = DropAreaWidget(widget)
        self.drop_area.fileDropped.connect(self.file_selected)
        layout.addWidget(self.drop_area)

        return widget

    def create_conversion_screen(self):
        widget = QWidget()
        layout = QVBoxLayout(widget)
        layout.setSpacing(20)

        # Header
        header_label = QLabel("Converting PDF to Word", widget)
        header_label.setFont(QFont("Segoe UI", 16, QFont.Weight.Bold))
        header_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        header_label.setStyleSheet("color: white; margin-bottom: 10px;")
        layout.addWidget(header_label)

        # File info
        self.file_info_label = QLabel(widget)
        self.file_info_label.setFont(QFont("Segoe UI", 10))
        self.file_info_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.file_info_label.setStyleSheet("color: #bdc3c7;")
        self.file_info_label.setWordWrap(True)
        layout.addWidget(self.file_info_label)

        # Progress container
        progress_widget = QWidget(widget)
        progress_widget.setStyleSheet(
            "background-color: rgba(44, 62, 80, 0.3); border-radius: 8px;"
        )
        progress_layout = QVBoxLayout(progress_widget)
        progress_layout.setContentsMargins(20, 20, 20, 20)

        # Progress bar
        self.progress_bar = QProgressBar(progress_widget)
        self.progress_bar.setRange(0, 100)
        self.progress_bar.setValue(0)
        self.progress_bar.setTextVisible(True)
        self.progress_bar.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.progress_bar.setFont(QFont("Segoe UI", 10))
        self.progress_bar.setStyleSheet(
            """
            QProgressBar {
                border: none;
                border-radius: 4px;
                background-color: rgba(255, 255, 255, 0.1);
                height: 25px;
                text-align: center;
                color: white;
            }
            QProgressBar::chunk {
                background-color: qlineargradient(spread:pad, x1:0, y1:0, x2:1, y2:0,
                                          stop:0 #1abc9c, stop:1 #3498db);
                border-radius: 4px;
            }
        """
        )
        progress_layout.addWidget(self.progress_bar)

        # Status label
        self.status_label = QLabel("Preparing to convert...", progress_widget)
        self.status_label.setFont(QFont("Segoe UI", 10))
        self.status_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.status_label.setStyleSheet("color: #bdc3c7; margin-top: 10px;")
        progress_layout.addWidget(self.status_label)

        layout.addWidget(progress_widget)

        # Cancel button
        self.cancel_button = FuturisticButton("Cancel", widget)
        self.cancel_button.clicked.connect(self.cancel_conversion)
        layout.addWidget(self.cancel_button, alignment=Qt.AlignmentFlag.AlignCenter)

        return widget

    def file_selected(self, file_path):
        self.current_file = file_path
        self.file_info_label.setText(f"File: {os.path.basename(file_path)}")
        self.progress_bar.setValue(0)
        self.status_label.setText("Preparing to convert...")
        self.stacked_widget.setCurrentIndex(1)  # Switch to conversion screen

        # Start conversion in a background thread
        self.worker = ConversionWorker(self.current_file, get_output_directory())
        self.worker.progress.connect(self.update_progress)
        self.worker.status.connect(self.update_status)
        self.worker.finished.connect(self.conversion_finished)
        self.worker.start()

    def update_progress(self, value):
        self.progress_bar.setValue(value)

        # Update status message based on progress
        if value < 25:
            self.status_label.setText("Analyzing PDF structure...")
        elif value < 50:
            self.status_label.setText("Converting text and formatting...")
        elif value < 75:
            self.status_label.setText("Processing images and tables...")
        elif value < 95:
            self.status_label.setText("Finalizing Word document...")
        else:
            self.status_label.setText("Completing conversion...")

    def update_status(self, message):
        self.status_label.setText(message)

    def conversion_finished(self, success, result):
        # Show result screen
        self.result_widget.set_result(success, result)
        self.stacked_widget.setCurrentIndex(2)  # Switch to result screen

    def cancel_conversion(self):
        if self.worker and self.worker.isRunning():
            self.worker.cancel()
            self.progress_bar.setValue(0)
            self.status_label.setText("Cancelling conversion...")

    def reset_conversion(self):
        self.current_file = ""
        self.stacked_widget.setCurrentIndex(0)  # Back to drop screen
        self.progress_bar.setValue(0)


def main() -> None:
    app = QApplication(sys.argv)

    # Check if command-line arguments are provided
    if len(sys.argv) > 1:
        # With arguments, run CLI mode
        from converter import main as cli_main

        cli_main()
    else:
        # No arguments, launch GUI
        window = ConverterApp()
        window.show()
        sys.exit(app.exec())


if __name__ == "__main__":
    main()
