# SAGAR-DRISHTI Backend Data

Place **preprocessed prototype data** in the folders below. The API reads these folders automatically.

## Sea ice: `data/sea_ice/`
Preferred CSV columns:

`timestamp,latitude,longitude,concentration`

`concentration` may be either `0..1` or percentage `0..100`.

NetCDF is also supported. The loader looks for common variable names such as `siconc`, `sic`, `sea_ice_concentration` and coordinates `lat/lon` or `latitude/longitude`.

## Ocean: `data/ocean/`
Preferred CSV columns:

`timestamp,latitude,longitude,current_speed,current_direction`

For NetCDF, the loader supports common CMEMS-style `uo` and `vo` variables with `lat/lon` and an optional `time` dimension. Speed and direction are calculated from `u/v`.

## Weather and waves: `data/weather/`
Preferred CSV columns:

`timestamp,latitude,longitude,wind_speed,wind_direction,wave_height,wave_period`

NetCDF support recognizes common names such as `wind_speed/ws/si10`, `wave_height/swh/VHM0` and `wave_period/mwp/VTM02`.

## Important

Do not put raw, very large scientific files into MongoDB. Keep scientific data in these filesystem/NetCDF sources and use MongoDB later for application state and results.
