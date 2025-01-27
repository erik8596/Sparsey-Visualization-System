from vispy import app, scene
from vispy_utils.config_loader import load_config
from vispy_utils.vispy_helpers import create_mac, create_cm, create_neurons

# Load configuration
layers = load_config()

# Canvas setup
canvas = scene.SceneCanvas(keys='interactive', bgcolor='black', size=(1000, 800))
view = canvas.central_widget.add_view()
view.camera = scene.cameras.TurntableCamera(azimuth=30, elevation=30, distance=50)

mac_spacing = 2.0  # Adjust spacing to prevent overlap

# Determine the total grid size for centering
max_rows = max(layer["params"]["mac_grid_num_rows"] for layer in layers)
max_cols = max(layer["params"]["mac_grid_num_cols"] for layer in layers)
center_offset_x = (max_cols) 
center_offset_y = (max_rows)

for index, layer in enumerate(layers):
    params = layer["params"]

    num_macs = params["num_macs"]
    grid_rows = params["mac_grid_num_rows"]
    grid_cols = params["mac_grid_num_cols"]
    num_cms_per_mac = params["num_cms_per_mac"]
    num_neurons_per_cm = params["num_neurons_per_cm"]

    for i in range(grid_rows):
        for j in range(grid_cols):
            # Center the MAC grid by subtracting the offset
            mac_position = (i * mac_spacing - center_offset_x, 
                            j * mac_spacing - center_offset_y, 
                            index * mac_spacing)

            # Position CM in the center of the MAC
            cm_position = (mac_position[0] , 
                           mac_position[1] , 
                           mac_position[2])

            create_mac(view, mac_position, size=1.0, color='white')
            create_cm(view, cm_position, size=0.6, color='cyan')  # Ensure CM is smaller than MAC
            create_neurons(view, cm_position, count=num_neurons_per_cm, spread=0.3, color='red')

canvas.show()
app.run()
