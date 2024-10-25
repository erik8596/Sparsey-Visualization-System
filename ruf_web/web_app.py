from flask import Flask, render_template
import plotly.graph_objs as go
import numpy as np
from igraph import Graph, EdgeSeq  # Ensure igraph is installed

app = Flask(__name__)

@app.route('/')
def index():
    # Create a binary tree
    nr_vertices = 25
    v_label = list(map(str, range(nr_vertices)))
    G = Graph.Tree(nr_vertices, 2)  # 2 stands for number of children

    # Get layout for a tree
    lay = G.layout('rt')

    # Prepare positions
    position = {k: lay[k] for k in range(nr_vertices)}
    Y = [lay[k][1] for k in range(nr_vertices)]
    
    # Extract edges
    es = EdgeSeq(G)  # sequence of edges
    E = [e.tuple for e in G.es]  # list of edges

    # Prepare coordinates for nodes and edges
    L = len(position)
    Xn, Yn, Zn = [], [], []

    # Create spacing for conical shape
    for k in range(L):
        # Use vertex index directly
        depth = k
        level = int(np.floor(np.log2(depth + 1))) if depth > 0 else 0
        angle = (depth % (2 ** level)) * (360 / (2 ** level))

        # Calculate x and y based on the level and angle
        x = level * np.cos(np.radians(angle)) * 1.5  # Scale for spacing
        y = level * np.sin(np.radians(angle)) * 1.5
        z = -depth * 1  # Negative for a downward tree

        Xn.append(x)
        Yn.append(y)
        Zn.append(z)

    Xe, Ye, Ze = [], [], []  # Edge coordinates
    for edge in E:
        # Calculate edge coordinates with conical effect
        Xe += [Xn[edge[0]], Xn[edge[1]], None]
        Ye += [Yn[edge[0]], Yn[edge[1]], None]
        Ze += [Zn[edge[0]], Zn[edge[1]], None]  # Use z-coordinates for edges

    # Create Plotly Figure
    fig = go.Figure()

    # Add edges
    fig.add_trace(go.Scatter3d(
        x=Xe,
        y=Ye,
        z=Ze,
        mode='lines',
        line=dict(color='rgb(210,210,210)', width=1),
        hoverinfo='none'
    ))

    # Add nodes
    fig.add_trace(go.Scatter3d(
        x=Xn,
        y=Yn,
        z=Zn,
        mode='markers',
        name='Nodes',
        marker=dict(
            symbol='circle',
            size=8,
            color='#0066cc',
            line=dict(color='rgb(50,50,50)', width=1)
        ),
        text=v_label,
        hoverinfo='text',
        opacity=0.8
    ))

    # Layout settings for 3D visualization
    fig.update_layout(
        title='3D Conical Binary Tree Visualization',
        scene=dict(
            xaxis=dict(title='X'),
            yaxis=dict(title='Y'),
            zaxis=dict(title='Depth'),
            bgcolor='white',  # Set background color to white
            aspectmode='manual',
            aspectratio=dict(x=1, y=1, z=1)  # Adjust for better view
        ),
        showlegend=False,
        width=800,
        height=800
    )

    plot_html = fig.to_html(full_html=True)

    return render_template('index.html', plot=plot_html)

if __name__ == '__main__':
    app.run(debug=True)
