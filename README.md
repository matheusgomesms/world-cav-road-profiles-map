# CAV Readiness Map: A Global Analysis of Urban Road Infrastructure

[![License: MIT](https://img.shields.io/badge/Code%20License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![License: ODbL](https://img.shields.io/badge/License-ODbL-brightgreen.svg)](https://opendatacommons.org/licenses/odbl/)

An interactive map analyzing the infrastructure readiness of 100 cities for Connected and Autonomous Vehicles (CAVs), based on OpenStreetMap data.

**[► View the Live Map Here](https://matheusgomesms.github.io/world-cav-readiness-map/)**

![Screenshot of the CAV Readiness Map](assets/social-preview.png)

## About The Project

This project provides a visual exploration of road infrastructure characteristics across 7 million street segments in 100 global cities. Using unsupervised machine learning, road segments were grouped into four distinct clusters (A, B, C, D) based on features critical for autonomous navigation, such as the density of traffic signs, signals, and pedestrian crossings.

This tool is designed for urban planners, policymakers, researchers, and the public to:
*   Visualize infrastructure patterns within and between cities.
*   Understand the varying levels of "readiness" for autonomous vehicle deployment.
*   Identify areas with minimal infrastructure that may pose challenges for CAVs.

## Key Features

*   **Interactive World Map:** Explore 100 cities with color-coded markers indicating their dominant infrastructure type.
*   **Detailed City View:** Select a city to view its entire road network, with each segment colored by its infrastructure cluster.
*   **Dynamic Filtering:** Toggle cluster visibility on the legend to isolate and analyze specific road types.
*   **Segment-Level Data:** Hover over any road segment to see its specific attributes in a popup.
*   **City-Wide Metrics:** View a summary of each city's cluster distribution and income level in a dedicated panel.

## Data and Methodology

The underlying road network data was sourced from **OpenStreetMap** and retrieved between **March and April 2025**. The cluster analysis and feature extraction were performed as part of the research detailed in the paper below.

### Associated Research Paper

This visualization is a companion to our academic research. For a detailed explanation of the methodology, cluster definitions, and findings, please refer to our paper:

**[A Scalable Machine Learning Framework for Assessing Urban Infrastructure Readiness for Automated Vehicles](https://dx.doi.org/10.2139/ssrn.5357778)**

### How to Cite

If you use this project, its data, or its findings in your research, please cite our work as follows:

`Gomes Correia, Matheus and Prata, Bruno de Athayde and Ferreira, Adelino, A Scalable Machine Learning Framework for Assessing Urban Infrastructure Readiness for Automated Vehicles. Available at SSRN: http://dx.doi.org/10.2139/ssrn.5357778`


## License

This project uses a dual-license model:

*   The **source code** for this web application is licensed under the **[MIT License](LICENSE_CODE)**.
*   The **data** (`.pmtiles`, and `.json` files) is licensed under the **[Open Data Commons Open Database License (ODbL)](LICENSE_DATA)**.

## Contact

[Matheus Gomes Correia] – [https://www.linkedin.com/in/matheuscorreia/]