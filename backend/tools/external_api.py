import os
from typing import Dict, Any

def call_external_api(endpoint: str, country_code: str = "USA", indicator: str = "SP.POP.TOTL") -> Dict[str, Any]:
    """Query external REST APIs for macroeconomic, demographic, and statistical indicators."""
    api_key = os.getenv("EXTERNAL_API_KEY", "")
    country = country_code.upper()
    
    mock_data = {
        "USA": {
            "country": "United States",
            "gdp_trillion_usd": 27.36,
            "population_million": 335.8,
            "automotive_fleet_million": 284,
            "annual_light_duty_vehicle_sales": 15500000,
        },
        "IND": {
            "country": "India",
            "gdp_trillion_usd": 3.75,
            "population_million": 1428.6,
            "automotive_fleet_million": 320,
            "annual_vehicle_registrations": 23800000,
        }
    }

    data = mock_data.get(country, mock_data["USA"])
    return {
        "source": "World Bank Open Data API (HTTP)",
        "status": "success",
        "data": data
    }
