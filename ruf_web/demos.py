import plotly.graph_objects as go
import numpy as np
from igraph import Graph, EdgeSeq
import networkx as nx


def binaryTreeVisual():
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
            size=6,
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

    return fig


def neuralNetVisual():
    # Define the neural network architecture
    input_layer_size = 3  # Number of input neurons
    hidden_layer_size = 5  # Number of hidden neurons
    output_layer_size = 2  # Number of output neurons

    # Generate coordinates for the neurons in each layer
    def generate_coordinates(layer_size, layer_index, layer_spacing, neuron_spacing):
        return [(layer_index * layer_spacing, j * neuron_spacing, 0) for j in range(layer_size)]

    # Layer spacing
    layer_spacing = 5
    neuron_spacing = 1

    # Generate coordinates for each layer
    input_layer_coords = generate_coordinates(input_layer_size, 0, layer_spacing, neuron_spacing)
    hidden_layer_coords = generate_coordinates(hidden_layer_size, 1, layer_spacing, neuron_spacing)
    output_layer_coords = generate_coordinates(output_layer_size, 2, layer_spacing, neuron_spacing)

    # Combine all coordinates
    all_coords = input_layer_coords + hidden_layer_coords + output_layer_coords

    # Create edges (connections) between neurons
    edges = []
    for i in range(input_layer_size):
        for j in range(hidden_layer_size):
            edges.append((i, input_layer_size + j))

    for i in range(hidden_layer_size):
        for j in range(output_layer_size):
            edges.append((input_layer_size + i, input_layer_size + hidden_layer_size + j))

    # Create 3D scatter plot for neurons
    neurons_x = [coord[0] for coord in all_coords]
    neurons_y = [coord[1] for coord in all_coords]
    neurons_z = [coord[2] for coord in all_coords]

    # Create a 3D scatter plot for neurons
    neurons_trace = go.Scatter3d(
        x=neurons_x,
        y=neurons_y,
        z=neurons_z,
        mode='markers+text',
        marker=dict(size=10, color='blue'),
        text=[f'Neuron {i+1}' for i in range(len(all_coords))],
        textposition="top center"
    )

    # Create lines for edges
    edges_x = []
    edges_y = []
    edges_z = []

    for edge in edges:
        x0, y0, z0 = all_coords[edge[0]]
        x1, y1, z1 = all_coords[edge[1]]
        edges_x.extend([x0, x1, None])
        edges_y.extend([y0, y1, None])
        edges_z.extend([z0, z1, None])

    edges_trace = go.Scatter3d(
        x=edges_x,
        y=edges_y,
        z=edges_z,
        mode='lines',
        line=dict(color='gray', width=2)
    )

    # Create a figure and add traces
    fig = go.Figure(data=[neurons_trace, edges_trace])

    # Update layout
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

    return fig