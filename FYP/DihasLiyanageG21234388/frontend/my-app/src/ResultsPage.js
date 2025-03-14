import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Plot from "react-plotly.js";
import "./Result.css";

/** 
 * -- Utility: interpretShapForFeature (Local) --
 * Groups SHAP values by x-value and then determines if the model strongly leans toward or against the predicted class.
 */
function interpretShapForFeature(featureData, threshold = 0.7) {
  if (!featureData || !featureData.x || !featureData.y) return [];
  const mapXToShapValues = {};
  // Group SHAP values by each x-value
  for (let i = 0; i < featureData.x.length; i++) {
    const xVal = featureData.x[i];
    const yVal = featureData.y[i];
    if (!mapXToShapValues[xVal]) {
      mapXToShapValues[xVal] = [];
    }
    mapXToShapValues[xVal].push(yVal);
  }
  const interpretationLines = [];
  // For each x value group, compute ratios and create interpretation line based on threshold
  for (const [xVal, shapVals] of Object.entries(mapXToShapValues)) {
    const totalCount = shapVals.length;
    const positiveCount = shapVals.filter((val) => val > 0).length;
    const negRatio = shapVals.filter((val) => val < 0).length / totalCount;
    const posRatio = positiveCount / totalCount;
    let line = `• For ${featureData.feature} = ${xVal}: (${positiveCount}/${totalCount} positive SHAP) → `;
    if (posRatio >= threshold) {
      line += "The model strongly leans toward the predicted variable's class.";
    } else if (negRatio >= threshold) {
      line += "The model strongly leans against the predicted variable's class.";
    } else {
      line += "No strong leaning (mixed SHAP signs).";
    }
    interpretationLines.push(line);
  }
  return interpretationLines;
}

/** 
 * -- Utility: interpretPdpSegments (Local) --
 *  Analyzes how the model's average prediction changes as the feature value changes.
 * Sorts data pairs and computes the difference between successive points.
 */
function interpretPdpSegments(featureData) {
  if (!featureData || !featureData.x || !featureData.y || featureData.x.length < 2) {
    return ["Insufficient data for PDP interpretation."];
  }
  const xyPairs = featureData.x.map((val, idx) => [val, featureData.y[idx]]);
  // Sort the pairs based on the x value
  xyPairs.sort((a, b) => a[0] - b[0]);
  const lines = [];
  // Compute the delta between consecutive points to determine the trend
  for (let i = 0; i < xyPairs.length - 1; i++) {
    const [x1, y1] = xyPairs[i];
    const [x2, y2] = xyPairs[i + 1];
    const delta = y2 - y1;
    let direction;
    if (Math.abs(delta) < 1e-5) {
      direction = `remains roughly the same (${y1.toFixed(3)} to ${y2.toFixed(3)})`;
    } else if (delta > 0) {
      direction = `increases from ${y1.toFixed(3)} to ${y2.toFixed(3)}`;
    } else {
      direction = `decreases from ${y1.toFixed(3)} to ${y2.toFixed(3)}`;
    }
    lines.push(
      `• As ${featureData.feature} goes from ${x1} to ${x2}, the model prediction for the target variable's class ${direction}.`
    );
  }
  return lines;
}

/** 
 * -- Global SHAP Interpretation --
 *  Groups all SHAP values by x and determines if the positive ratio meets the threshold.
 */
function interpretGlobalShapForFeatureAllX(featureData, threshold = 0.7) {
  if (!featureData || !featureData.x || !featureData.y) return [];
  const groups = {};
  // Group SHAP values by each x value
  for (let i = 0; i < featureData.x.length; i++) {
    const xVal = featureData.x[i];
    if (!groups[xVal]) groups[xVal] = [];
    groups[xVal].push(featureData.y[i]);
  }
  const lines = [];
  // For each group, if the positive ratio exceeds the threshold, create an interpretation line
  for (const xVal in groups) {
    const vals = groups[xVal];
    const total = vals.length;
    const posCount = vals.filter((v) => v > 0).length;
    const posRatio = posCount / total;
    if (posRatio >= threshold) {
      lines.push(
        `• Feature "${featureData.feature}" at x=${xVal}: strongly toward the predicted variable's class (positive SHAP: ${(posRatio * 100).toFixed(1)}%).`
      );
    }
  }
  return lines;
}

/** 
 * -- Render Global SHAP Plots --
 *  Iterates over each class in the global SHAP plots and renders a plot with corresponding interpretations.
 */
function renderGlobalShapPlots(shap_plots, threshold = 0.7) {
  const colorPalette = [
    "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728",
    "#9467bd", "#8c564b", "#e377c2", "#7f7f7f",
    "#bcbd22", "#17becf"
  ];

  return shap_plots.plots.map((plotClass, classIdx) => {
    // Create plot traces for each feature in the class with a unique color
    const traces = plotClass.data.map((featureData, i) => ({
      x: featureData.x,
      y: featureData.y,
      mode: "markers",
      type: "scatter",
      name: featureData.feature,
      marker: {
        color: colorPalette[i % colorPalette.length],
        size: 6,
      },
    }));

    let globalInterpretations = [];
    // Aggregate interpretations from all features in the class
    plotClass.data.forEach((featureData) => {
      const lines = interpretGlobalShapForFeatureAllX(featureData, threshold);
      globalInterpretations = globalInterpretations.concat(lines);
    });

    return (
      <div key={classIdx} className="global-plot-container">
        <h5>{plotClass.class_name}</h5>
        <div className="global-plot-row">
          <Plot
            data={traces}
            layout={{
              width: 800,
              height: 500,
              title: `${plotClass.class_name} - Global Interpretability`,
              xaxis: { title: "Feature Value" },
              yaxis: { title: "SHAP Value" },
              margin: { l: 60, r: 20, t: 50, b: 50 },
            }}
          />
          <div className="interpretation-box global-interpretation-box">
            <h6>Interpretation</h6>
            {globalInterpretations.length === 0 ? (
              <p>No strong leaning found.</p>
            ) : (
              globalInterpretations.map((line, i) => (
                <p key={i} style={{ margin: "5px 0" }}>
                  {line}
                </p>
              ))
            )}
          </div>
        </div>
      </div>
    );
  });
}

function ResultsPage() {
  const location = useLocation();
  const navigate = useNavigate();

  // Toggle: local vs global
  const [interpretabilityMode, setInterpretabilityMode] = useState("local");

  // Retrieve training results and model data from location state
  const { trainingResult, modelPklB64, modelFileName } = location.state || {};

  // Fallback if no training data found
  if (!trainingResult) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <h2>No training data found.</h2>
        <button onClick={() => navigate("/home")}>Go Back to Home</button>
      </div>
    );
  }

  // Destructure SHAP and PDP plots along with accuracy
  const { shap_plots, pdp_plots, accuracy } = trainingResult;
  const targetVar = shap_plots?.target_variable || "Unknown Target";

  // Extract feature names for SHAP and PDP (Local mode only)
  const shapFeatures =
    shap_plots?.plots?.length > 0
      ? shap_plots.plots[0].data.map((item) => item.feature)
      : [];

  const pdpFeatures =
    pdp_plots?.plots?.length > 0
      ? pdp_plots.plots[0].data.map((item) => item.feature)
      : [];

  /// Convert base64 string to Blob for model download
  const b64toBlob = (b64Data, contentType = "application/octet-stream", sliceSize = 512) => {
    const byteCharacters = atob(b64Data);
    const byteArrays = [];
    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
      const slice = byteCharacters.slice(offset, offset + sliceSize);
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }
    return new Blob(byteArrays, { type: contentType });
  };

  // Function to trigger model download
  const downloadModel = () => {
    if (!modelPklB64) return;
    const blob = b64toBlob(modelPklB64, "application/octet-stream");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = modelFileName || "model.pkl";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Toggle handler
  const handleToggle = (mode) => {
    setInterpretabilityMode(mode);
  };

  // Scrolls smoothly to a given feature section by its ID
  const scrollToFeature = (featureId) => {
    const el = document.getElementById(featureId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="results-page-container">
      <header className="navbar">
        <div className="navbar-title">
          <h1>Bitcoin Prediction Interpreter</h1>
        </div>
        <nav className="navbar-links">
          <button onClick={() => navigate("/home")}>Home</button>
          <button onClick={() => navigate("/")}>Log Out</button>
        </nav>
      </header>

      <main>
        <section className="results-header">
          <h2>Results for target: {targetVar}</h2>
          <p>Accuracy: {accuracy ? (accuracy * 100).toFixed(2) : "N/A"}%</p>
          {modelPklB64 && (
            <button className="download-btn" onClick={downloadModel}>
              Download Model ({modelFileName})
            </button>
          )}
        </section>

        {/* Toggle buttons */}
        <div className="toggle-container">
          <button
            onClick={() => handleToggle("local")}
            className={interpretabilityMode === "local" ? "active" : ""}
          >
            Local Interpretability
          </button>
          <button
            onClick={() => handleToggle("global")}
            className={interpretabilityMode === "global" ? "active" : ""}
          >
            Global Interpretability
          </button>
        </div>

        {/* SHAP Section */}
        <section className="info-section">
          <div className="section-header" style={{ display: "flex", justifyContent: "space-between" }}>
            <h3>SHAP Dependence Plots</h3>
            {interpretabilityMode === "local" && shapFeatures.length > 0 && (
              <div>
                <select
                  onChange={(e) => {
                    const selectedFeature = e.target.value;
                    if (selectedFeature) {
                      // Scroll to selected SHAP feature section
                      scrollToFeature(`result-shap-feature-${selectedFeature}`);
                    }
                  }}
                >
                  <option value="">Jump to feature...</option>
                  {shapFeatures.map((feat) => (
                    <option key={feat} value={feat}>
                      {feat}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {interpretabilityMode === "global" ? (
            // Render global SHAP plots if in Global mode
            renderGlobalShapPlots(shap_plots, 0.7)
          ) : (
            // Otherwise, render local SHAP plots for each feature
            shapFeatures.map((feature) => (
              <div
                key={feature}
                id={`result-shap-feature-${feature}`}
                className="feature-section"
              >
                <h4 className="feature-title">{feature}</h4>
                {shap_plots.plots.map((plotClass, idx) => {
                  const featureData = plotClass.data.find(
                    (f) => f.feature === feature
                  );
                  if (!featureData) return null;

                  const shapInterpretations = interpretShapForFeature(featureData, 0.7);

                  return (
                    <div key={idx} className="class-row">
                      <div className="plot-box">
                        <h5>{plotClass.class_name}</h5>
                        <Plot
                          data={[
                            {
                              x: featureData.x,
                              y: featureData.y,
                              mode: "markers",
                              type: "scatter",
                              marker: { color: "blue" },
                            },
                          ]}
                          layout={{
                            width: 320,
                            height: 240,
                            margin: { l: 50, r: 20, t: 40, b: 50 },
                            xaxis: { title: feature },
                            yaxis: { title: "SHAP Value" },
                            title: `${feature} - ${plotClass.class_name}`,
                          }}
                        />
                      </div>
                      <div className="interpretation-box">
                        <h5>Interpretation</h5>
                        {shapInterpretations.length === 0 ? (
                          <p>No SHAP data to interpret.</p>
                        ) : (
                          shapInterpretations.map((line, i) => (
                            <p key={i} style={{ margin: "5px 0" }}>
                              {line}
                            </p>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </section>

        {/* PDP Section (Local Only) */}
        {interpretabilityMode === "local" && (
          <section className="info-section">
            <div className="section-header" style={{ display: "flex", justifyContent: "space-between" }}>
              <h3>Partial Dependence Plots (PDPs)</h3>
              {pdpFeatures.length > 0 && (
                <div>
                  <select
                    onChange={(e) => {
                      const selectedFeature = e.target.value;
                      if (selectedFeature) {
                        // Scroll to selected PDP feature section
                        scrollToFeature(`result-pdp-feature-${selectedFeature}`);
                      }
                    }}
                  >
                    <option value="">Jump to feature...</option>
                    {pdpFeatures.map((feat) => (
                      <option key={feat} value={feat}>
                        {feat}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {pdpFeatures.map((feature) => (
              <div
                key={feature}
                id={`result-pdp-feature-${feature}`}
                className="feature-section"
              >
                <h4 className="feature-title">{feature}</h4>
                {pdp_plots.plots.map((plotClass, idx) => {
                  const featureData = plotClass.data.find(
                    (f) => f.feature === feature
                  );
                  if (!featureData) return null;

                  const pdpInterpretations = interpretPdpSegments(featureData);

                  return (
                    <div key={idx} className="class-row">
                      <div className="plot-box">
                        <h5>{plotClass.class_name}</h5>
                        <Plot
                          data={[
                            {
                              x: featureData.x,
                              y: featureData.y,
                              mode: "lines",
                              type: "scatter",
                              line: { color: "green" },
                            },
                          ]}
                          layout={{
                            width: 320,
                            height: 240,
                            margin: { l: 50, r: 20, t: 40, b: 50 },
                            xaxis: { title: feature },
                            yaxis: { title: "Average Prediction" },
                            title: `${feature} - ${plotClass.class_name}`,
                          }}
                        />
                      </div>
                      <div className="interpretation-box">
                        <h5>Interpretation</h5>
                        {pdpInterpretations.map((line, i) => (
                          <p key={i} style={{ margin: "5px 0" }}>
                            {line}
                          </p>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}

export default ResultsPage;
