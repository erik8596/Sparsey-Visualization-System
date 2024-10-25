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
    G = Graph.Tree(nr_vertices, 2)  # 2 stands for children number

    # Generate layout using spring layout for clustering
    spring_layout = G.layout('fr')  # Fruchterman-Reingold layout

    # Prepare positions
    position = {k: spring_layout[k] for k in range(nr_vertices)}

    # Prepare coordinates for nodes and edges
    Xn = []
    Yn = []
    Zn = []

    # Create spacing for cone shape
    for k in range(nr_vertices):
        # Calculate level for conical effect
        level = int(np.floor(np.log2(k + 1))) if k > 0 else 0
        z = -level * 2  # Negative for a downward tree

        # Spread nodes horizontally based on spring layout
        x = position[k][0]
        y = position[k][1]

        Xn.append(x)
        Yn.append(y)
        Zn.append(z)

    Xe = []
    Ye = []
    Ze = []  # z-coordinate for edges
    for edge in G.es:
        Xe += [Xn[edge.source], Xn[edge.target], None]
        Ye += [Yn[edge.source], Yn[edge.target], None]
        Ze += [Zn[edge.source], Zn[edge.target], None]  # Use z-coordinates for edges

    # Create Plotly Figure
    fig = go.Figure()

    # Add edges
    fig.add_trace(go.Scatter3d(
        x=Xe,
        y=Ye,
        z=Ze,
        mode='lines',
        line=dict(color='rgb(0,0,0)', width=1),
        hoverinfo='none',
        showlegend=False
    ))

    # Add nodes
    fig.add_trace(go.Scatter3d(
        x=Xn,
        y=Yn,
        z=Zn,
        mode='markers',
        name='Nodes',
        marker=dict(
            symbol='circle',  # Valid symbol
            size=8,
            color='#0066cc',
            line=dict(color='rgb(50,50,50)', width=1)
        ),
        text=v_label,
        hoverinfo='text',
        opacity=1,
        showlegend=False
    ))


    # # Layout settings for 3D visualization

    # Update plot sizing
    fig.update_layout(
    title='3D Conical Binary Tree Visualization',
    scene=dict(
        xaxis=dict(
            title='X',
            showgrid=False,
            zeroline=False,
            visible=False  # Hide the x-axis
        ),
        yaxis=dict(
            title='Y',
            showgrid=False,
            zeroline=False,
            visible=False  # Hide the y-axis
        ),
        zaxis=dict(
            title='Depth',
            showgrid=False,
            zeroline=False,
            visible=False  # Hide the z-axis
        ),
        bgcolor='white',  # Set background color to white
        aspectmode='manual',
        aspectratio=dict(x=1, y=1, z=1),  # Adjust for better view
    ),
        template="simple_white",
        showlegend=False,
        width=1000,
        height=800,
        margin=dict(l=50, r=50, b=50, t=50)
    )

    # Update 3D scene options
    fig.update_scenes(
        aspectratio=dict(x=1, y=1, z=0.7),
        # aspectmode="manual"
    )

    plot_html = fig.to_html(full_html=True)

    return render_template('index.html', plot=plot_html)

if __name__ == '__main__':
    app.run(debug=True)
