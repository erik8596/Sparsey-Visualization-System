import sys
from PyQt5.QtWidgets import QApplication, QMainWindow, QVBoxLayout, QWidget
from PyQt5.QtWebEngineWidgets import QWebEngineView
import plotly.graph_objs as go
import plotly.express as px

from ruf_web.demos import binaryTreeVisual

class PlotlyWindow(QMainWindow):
    def __init__(self):
        super().__init__()

        self.setWindowTitle("Plotly in PyQt")

        # Create a Plotly figure
        # fig = px.scatter(x=[1, 2, 3], y=[4, 5, 6], title="Scatter Plot")
        fig = binaryTreeVisual()
        fig_html = fig.to_html(include_plotlyjs='cdn')

        # Create WebEngineView widget to display Plotly figure
        self.browser = QWebEngineView()
        self.browser.setHtml(fig_html)

        # Set layout
        layout = QVBoxLayout()
        layout.addWidget(self.browser)

        # Central widget
        container = QWidget()
        container.setLayout(layout)
        self.setCentralWidget(container)

if __name__ == "__main__":
    app = QApplication(sys.argv)
    window = PlotlyWindow()
    window.show()
    sys.exit(app.exec_())
