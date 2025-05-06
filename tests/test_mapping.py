"""
Test mapping configuration to help with test migrations.
"""

# Map expected route paths to actual implementation paths
ROUTE_PATHS = {
    "src.web.routes.visualization_routes": "src.web.routes.api",
    "src.web.routes.navigation_routes": "src.web.routes.api"
}

# Map expected API endpoints to actual endpoints
API_ENDPOINTS = {
    "/api/toggle-mac": "/api/toggle-mac",
    "/api/visualization-state": "/api/visualization-state",
    # Add other mappings as needed
}

# Map expected WandBFacade methods to actual method names
FACADE_METHODS = {
    "get_temporal_data": "get_temporal_data",
    "get_receptive_fields": "get_receptive_fields",
    "get_activation_data": "get_activation_data",
    "get_weighted_connections": "get_weighted_connections"
}
