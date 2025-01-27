import numpy as np
from vispy import scene

def create_mac(view, position, size=1.0, color='white'):
    mac = scene.visuals.Polygon(pos=hexagon_vertices(size), 
                                color=None, border_color=color, border_width=2)
    mac.transform = scene.transforms.STTransform(translate=position)
    view.add(mac)

def create_cm(view, position, size=0.6, color='cyan'):
    cm = scene.visuals.Polygon(pos=hexagon_vertices(size), 
                               color=None, border_color=color, border_width=2)
    cm.transform = scene.transforms.STTransform(translate=position)
    view.add(cm)

def create_neurons(view, position, count=8, spread=0.3, color='red'):
    # Evenly distribute neurons in a circular shape inside the CM
    angles = np.linspace(0, 2 * np.pi, count, endpoint=False)
    radius = spread / 2
    neuron_positions = np.column_stack((
        np.cos(angles) * radius, 
        np.sin(angles) * radius, 
        np.zeros(count)
    ))

    neurons = scene.visuals.Markers()
    neurons.set_data(pos=neuron_positions + position, edge_color=color, face_color=None, size=10)
    view.add(neurons)

def hexagon_vertices(size):
    angles = np.linspace(0, 2 * np.pi, 7)  # 6 sides + closing point
    return np.column_stack((np.cos(angles), np.sin(angles), np.zeros_like(angles))) * size
