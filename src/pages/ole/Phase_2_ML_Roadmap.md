# Phase 2: Machine Learning Prediction Roadmap (XGBoost / Random Forest)

This document serves as a reminder for the prerequisites required to upgrade the OLE Projection module from Statistical Models (ARIMA/Holt-Winters) to fully contextual Machine Learning models.

## Why Machine Learning?
While Phase 1 statistical models (ARIMA) are excellent at finding mathematical trends in the OLE % sequence, they are "blind" to the factory floor context. An ML model like **XGBoost** is multivariate—it learns the root causes of OLE fluctuations by analyzing external factors (Headcount, Schedule, Part Complexity).

## Prerequisites to Implement Phase 2

### 1. Feature Engineering (Historical Data)
We need to expose the following data points to the model training pipeline:
- `avg_hc_direct`: How does headcount size impact efficiency?
- `shift_count`: Are 3-shift weeks historically less efficient than 2-shift weeks?
- `smh_coverage_pct`: Does poor data quality correlate with lower OLE?
- **MES Routing Data (New):** We need to know which specific Part Models / Assemblies were run during that week. (e.g., Model A is inherently harder to build and naturally suppresses OLE).
- **Time/Seasonality:** ISO Week number, Month, Day of the Week.

### 2. "Planned" Data Architecture
**CRITICAL REQUIREMENT:** To predict next week's OLE using an ML model, you cannot just look backward. The model requires you to feed it *next week's expected features*.
- You must create a database table for **Planned Production Schedule**.
- Before querying the ML model for a projection, the system must know:
  - What is the planned Headcount for next week?
  - What Part Models are scheduled to be built next week?
  - How many shifts are planned?

### 3. Backend ML Pipeline
- **Training Script:** A script to pull the historical Parquet data, train the XGBoost model using `scikit-learn`, and evaluate its accuracy using cross-validation.
- **Model Storage:** The trained model weights must be saved as a `.json` or `.pkl` file.
- **Inference Endpoint:** The `/api/ole/predict` endpoint must be updated to load the trained model weights, accept the "Planned Data" payload from the frontend, and run `model.predict()`.

---
*Note: Do not start Phase 2 until the Planned Production Schedule data pipeline is established.*
