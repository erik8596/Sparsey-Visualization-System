import plotly.graph_objects as go
import numpy as np
from grid_utils import mac_boundary
# from visualize_input_layer import get_input_layer_traces

"""implementation for rendering 3D instances. Slower, but contains logic for rendering multiple layers"""
class RenderManager:
    def __init__(self):
        self.fig = go.Figure()

    def add_mac(self, x, y, z, size):
        """Add a MAC with a hexagonal boundary."""
        mac_x, mac_y = mac_boundary(x, y, size=size)

        self.fig.add_trace(go.Scatter3d(
            x=mac_x, y=mac_y, z=[z] * len(mac_x),
            mode="lines", line=dict(color="blue", width=3),
            name=f"MAC ({x}, {y}, {z})",
            hovertext=f"Z-Level: {z}",
            hoverinfo="text"
        ))

    def add_cm(self, cm_positions, z, size):
        """Add CMs with circular boundaries inside a MAC."""
        for cm_x, cm_y in cm_positions:
            angles = np.linspace(0, 2 * np.pi, 10)  # Circle points
            cm_x_vals = cm_x + size * np.cos(angles)
            cm_y_vals = cm_y + size * np.sin(angles)

            self.fig.add_trace(go.Scatter3d(
                x=cm_x_vals, y=cm_y_vals, z=[z] * len(cm_x_vals),
                mode="lines", line=dict(color="green", width=2),
                name=f"CM ({cm_x}, {cm_y}, {z})",
                hovertext=f"Z-Level: {z}",
                hoverinfo="text"
            ))

    def add_neurons(self, neuron_positions, z, radius):
        """Add neurons as individual circular traces."""
        for neuron_x, neuron_y in neuron_positions:
            angles = np.linspace(0, 2 * np.pi, 10)
            neuron_x_vals = neuron_x + radius * np.cos(angles)
            neuron_y_vals = neuron_y + radius * np.sin(angles)

            self.fig.add_trace(go.Scatter3d(
                x=neuron_x_vals, y=neuron_y_vals, z=[z] * len(neuron_x_vals),
                mode="lines", line=dict(color="black", width=2),
                name=f"Neuron ({neuron_x}, {neuron_y}, {z})",
                hovertext=f"Z-Level: {z}",
                hoverinfo="text"
            ))

    def show(self):
        """Display the 3D visualization."""
        self.fig.update_layout(
            scene=dict(
                xaxis=dict(showgrid=False, visible=False),
                yaxis=dict(showgrid=False, visible=False),
                zaxis=dict(showgrid=False, visible=False)
            ),
            showlegend=False  # Hide the legend for a cleaner display
        )
        self.fig.show()

"""implementation for rendering 2D instances. Faster, but contains bugs when rendering multiple layers"""
# class RenderManager:
#     def __init__(self):
#         self.fig = go.Figure()
#         self.layer_spacing = 10  # Fixed spacing between layers

#     def add_mac(self, x, y, z, size):
#         """Add a MAC with a hexagonal boundary."""
#         mac_x, mac_y = mac_boundary(x, y, size=size)

#         # Apply vertical offset for the entire layer
#         mac_y = [coord + z * self.layer_spacing for coord in mac_y]

#         self.fig.add_trace(go.Scattergl(
#             x=mac_x, y=mac_y,
#             mode="lines", line=dict(color="blue", width=3),
#             name=f"MAC (Layer {z})",
#             hovertext=f"Layer {z}",
#             hoverinfo="text"
#         ))

#     def add_cm(self, cm_positions, z, size):
#         """Add CMs with circular boundaries inside a MAC."""
#         for cm_x, cm_y in cm_positions:
#             angles = np.linspace(0, 2 * np.pi, 10)  # Circle points
#             cm_x_vals = cm_x + size * np.cos(angles)
#             cm_y_vals = cm_y + size * np.sin(angles)

#             # Apply vertical offset for the entire layer
#             cm_y_vals = [coord + z * self.layer_spacing for coord in cm_y_vals]

#             self.fig.add_trace(go.Scattergl(
#                 x=cm_x_vals, y=cm_y_vals,
#                 mode="lines", line=dict(color="green", width=2),
#                 name=f"CM (Layer {z})",
#                 hovertext=f"Layer {z}",
#                 hoverinfo="text"
#             ))

#     def add_neurons(self, neuron_positions, z, radius):
#         """Add neurons as individual circular traces."""
#         for neuron_x, neuron_y in neuron_positions:
#             angles = np.linspace(0, 2 * np.pi, 10)
#             neuron_x_vals = neuron_x + radius * np.cos(angles)
#             neuron_y_vals = neuron_y + radius * np.sin(angles)

#             # Apply vertical offset for the entire layer
#             neuron_y_vals = [coord + z * self.layer_spacing for coord in neuron_y_vals]

#             self.fig.add_trace(go.Scattergl(
#                 x=neuron_x_vals, y=neuron_y_vals,
#                 mode="lines", line=dict(color="black", width=1),
#                 name=f"Neuron (Layer {z})",
#                 hovertext=f"Layer {z}",
#                 hoverinfo="text"
#             ))

#     def show(self):
#         """Display the 2D stacked layers visualization."""
#         self.fig.update_layout(
#             xaxis=dict(
#                 visible=False,  # Hide the x-axis
#                 showgrid=False,  # Hide the x-axis grid
#                 zeroline=False   # Hide the x-axis zero line
#             ),
#             yaxis=dict(
#                 visible=False,  # Hide the y-axis
#                 showgrid=False,  # Hide the y-axis grid
#                 zeroline=False   # Hide the y-axis zero line
#             ),
#             showlegend=False,  # Hide the legend
#             margin=dict(l=0, r=0, t=0, b=0)  # Remove margins for a clean display
#         )
#         self.fig.show()
