from flask import Flask, render_template
import plotly.graph_objs as go
import numpy as np
from igraph import Graph, EdgeSeq  # Ensure igraph is installed

from demos import binaryTreeVisual, neuralNetVisual

app = Flask(__name__)

@app.route('/')
def index():

    # fig = binaryTreeVisual()
    fig = neuralNetVisual()

    plot_html = fig.to_html(full_html=True)

    return render_template('index.html', plot=plot_html)

if __name__ == '__main__':
    app.run(debug=True)
