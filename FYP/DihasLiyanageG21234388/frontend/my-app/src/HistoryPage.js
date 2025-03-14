import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "./firebase"; // Adjust path as needed
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import Plot from "react-plotly.js";
import "./History.css";
import userGuideSHAP from "./UserGuideSHAP.png";
import userGuidePDP from "./UserGuidePDP.png";

// ------------------ Interpretation Helpers (Local) ------------------

// Processes SHAP data for a given feature and returns interpretation lines based on a threshold.
// Groups SHAP values by x-value and then determines if the positive or negative SHAPs dominate.
function interpretShapForFeature(featureData, threshold = 0.7) {
  if (!featureData || !featureData.x || !featureData.y) return [];
  const mapXToShapValues = {};
  for (let i = 0; i < featureData.x.length; i++) {
    const xVal = featureData.x[i];
    const yVal = featureData.y[i];
    if (!mapXToShapValues[xVal]) {
      mapXToShapValues[xVal] = [];
    }
    mapXToShapValues[xVal].push(yVal);
  }
  const interpretationLines = [];
  // Loop over grouped x-values and calculate ratios for positive and negative SHAP values.
  for (const [xVal, shapVals] of Object.entries(mapXToShapValues)) {
    const totalCount = shapVals.length;
    const positiveCount = shapVals.filter((val) => val > 0).length;
    const negRatio = shapVals.filter((val) => val < 0).length / totalCount;
    const posRatio = positiveCount / totalCount;
    let line = `• For ${featureData.feature} = ${xVal}: (${positiveCount} / ${totalCount} positive SHAP) → `;
    // Check if SHAP signs strongly indicate model leaning.
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

// Analyzes PDP data segments to interpret how predictions change as a feature varies.
// It sorts the data pairs and then computes the change (delta) between successive points.
function interpretPdpSegments(featureData) {
  if (!featureData || !featureData.x || !featureData.y || featureData.x.length < 2) {
    return ["Insufficient data for PDP interpretation."];
  }
  const xyPairs = featureData.x.map((val, idx) => [val, featureData.y[idx]]);
  xyPairs.sort((a, b) => a[0] - b[0]);
  const lines = [];
  for (let i = 0; i < xyPairs.length - 1; i++) {
    const [x1, y1] = xyPairs[i];
    const [x2, y2] = xyPairs[i + 1];
    const delta = y2 - y1;
    let direction;
    // Determine the direction of change between points.
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

// ------------------ NEW Global Interpretation (All X-values) ------------------

// Processes global SHAP data for a feature by grouping all x-values and interpreting if they strongly indicate a prediction.
// Uses a threshold to filter out features with strong leaning toward a class.
function interpretGlobalShapForFeatureAllX(featureData, threshold = 0.7) {
  if (!featureData || !featureData.x || !featureData.y) return [];
  const groups = {};
  for (let i = 0; i < featureData.x.length; i++) {
    const xVal = featureData.x[i];
    if (!groups[xVal]) groups[xVal] = [];
    groups[xVal].push(featureData.y[i]);
  }
  const lines = [];
  for (const xVal in groups) {
    const vals = groups[xVal];
    const total = vals.length;
    const posCount = vals.filter((v) => v > 0).length;
    const posRatio = posCount / total;
    // If positive SHAP ratio is above threshold, add an interpretation line.
    if (posRatio >= threshold) {
      lines.push(
        `• Feature "${featureData.feature}" at Class=${xVal}: strongly toward the predicted variable's class (positive SHAP: ${(posRatio * 100).toFixed(1)}%).`
      );
    }
  }
  return lines;
}

// Renders global SHAP plots for all x-values using Plotly, including an interpretation section for each class.
// Iterates over each plot class and constructs traces with unique colors.
function renderGlobalShapPlotsAllX(shap_plots, threshold = 0.7) {
  const colorPalette = [
    "#1f77b4",
    "#ff7f0e",
    "#2ca02c",
    "#d62728",
    "#9467bd",
    "#8c564b",
    "#e377c2",
    "#7f7f7f",
    "#bcbd22",
    "#17becf",
  ];

  return shap_plots.plots.map((plotClass, classIdx) => {
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
    // Concatenate interpretations for each feature in the class.
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
              title: `${plotClass.class_name} - Global Interpretability (All X-values)`,
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

// ------------------ Loading Modal Component ------------------

// Simple modal component to show a loading spinner and message while history data is being fetched.
function LoadingModal() {
  return (
    <div className="loading-modal">
      <div className="loading-modal-content">
        <div className="spinner"></div>
        <p>Trying to load your history...</p>
      </div>
    </div>
  );
}


// Main component for displaying the history page, which includes training history records, interpretability plots, and user guide sections.
function HistoryPage() {
  const [trainingHistory, setTrainingHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [interpretabilityMode, setInterpretabilityMode] = useState("local");
  const navigate = useNavigate();

  useEffect(() => {
    // Listen for changes in authentication state and load training history if the user is authenticated.
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        try {
          const trainingsRef = collection(db, "user_data", user.uid, "trainings");
          // Query with orderBy to get records in ascending order by timestamp (earliest first)
          const qTrainings = query(trainingsRef, orderBy("timestamp", "asc"));
          const querySnapshot = await getDocs(qTrainings);
          const results = [];
          querySnapshot.forEach((docSnap) => {
            results.push(docSnap.data());
          });
          setTrainingHistory(results);
        } catch (error) {
          console.error("Error fetching training history:", error);
        } finally {
          setLoadingHistory(false);
        }
      } else {
        setTrainingHistory([]);
        setLoadingHistory(false);
      }
    });
    return () => unsubscribe();
  }, []);
  // Toggle between local and global interpretability modes.
  const handleToggle = (mode) => {
    setInterpretabilityMode(mode);
  };

  // New helper function: scroll smoothly to element
  const scrollToFeature = (elementId) => {
    const el = document.getElementById(elementId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="history-page-container">
      {loadingHistory && <LoadingModal />}
      <header className="navbar">
        <div className="navbar-title">
          <h1>Bitcoin Prediction Interpreter</h1>
        </div>
        <nav className="navbar-links">
          <a href="#home" onClick={() => navigate("/home")}>Home</a>
          <a href="#about">About</a>
          <a href="#user-guide">User Guide</a>
          <a href="#previous-records">Previous Records</a>
          <button className="logout-btn" onClick={() => navigate("/")}>Log Out</button>
        </nav>
      </header>

      <main>
        {trainingHistory.length > 0 && (
          <div className="training-links-container">
            {trainingHistory.map((_, index) => (
              <a
                key={index}
                href={`#training-${index + 1}`}
                className="training-link"
                style={{ marginRight: "1rem" }}
              >
                Training #{index + 1}
              </a>
            ))}
          </div>
        )}

        <section className="history-section">
          <h2 className="history-heading">History</h2>

          {/* Toggle Buttons */}
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

          {loadingHistory ? null : trainingHistory.length === 0 ? (
            <div className="no-records">No previous records available.</div>
          ) : (
            trainingHistory.map((training, index) => {
              const { shap_plots, pdp_plots, accuracy } = training;
              if (!shap_plots || !pdp_plots) {
                return (
                  <div key={index} className="training-block-container">
                    <p>Training data not found for this entry.</p>
                  </div>
                );
              }
              const targetVar = shap_plots.target_variable || "Unknown Target";

              // Gather feature names for dropdown (Local mode only)
              let allShapFeatures = [];
              let allPdpFeatures = [];
              if (interpretabilityMode === "local") {
                if (shap_plots.plots && shap_plots.plots.length > 0) {
                  allShapFeatures = shap_plots.plots[0].data.map(
                    (item) => item.feature
                  );
                }
                if (pdp_plots.plots && pdp_plots.plots.length > 0) {
                  allPdpFeatures = pdp_plots.plots[0].data.map(
                    (item) => item.feature
                  );
                }
              }

              return (
                <div
                  key={index}
                  id={`training-${index + 1}`}
                  className="training-block-container"
                >
                  <h3 className="training-title">
                    Training #{index + 1} – Target: {targetVar}
                  </h3>
                  <p>Accuracy: {(accuracy * 100).toFixed(2)}%</p>

                  {/* SHAP Section */}
                  <div className="info-section">
                    {interpretabilityMode === "local" ? (
                      <div
                        className="section-header"
                        style={{ display: "flex", justifyContent: "space-between" }}
                      >
                        <h4 style={{ margin: 0 }}>SHAP Dependence Plots</h4>
                        <div>
                          <select
                            onChange={(e) => {
                              const selectedFeature = e.target.value;
                              if (selectedFeature) {
                                scrollToFeature(`training-${index + 1}-shap-feature-${selectedFeature}`);
                              }
                            }}
                          >
                            <option value="">Jump to feature...</option>
                            {allShapFeatures.map((feat) => (
                              <option key={feat} value={feat}>
                                {feat}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ) : (
                      <h4>SHAP Dependence Plots</h4>
                    )}

                    {interpretabilityMode === "global" ? (
                      renderGlobalShapPlotsAllX(shap_plots, 0.7)
                    ) : (
                      shap_plots.plots[0].data.map((featureItem) => {
                        const featureName = featureItem.feature;
                        return (
                          <div
                            key={featureName}
                            id={`training-${index + 1}-shap-feature-${featureName}`}
                            className="feature-section"
                          >
                            <h5 className="feature-title">{featureName}</h5>
                            {shap_plots.plots.map((plotClass, classIdx) => {
                              const featureData = plotClass.data.find(
                                (f) => f.feature === featureName
                              );
                              if (!featureData) return null;
                              const shapInterpretations = interpretShapForFeature(
                                featureData,
                                0.7
                              );
                              return (
                                <div key={classIdx} className="class-row">
                                  <div className="plot-box">
                                    <h6>{plotClass.class_name}</h6>
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
                                        xaxis: { title: featureName },
                                        yaxis: { title: "SHAP Value" },
                                        title: `${featureName} - ${plotClass.class_name}`,
                                      }}
                                    />
                                  </div>
                                  <div className="interpretation-box">
                                    <h6>Interpretation</h6>
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
                        );
                      })
                    )}
                  </div>

                  {/* PDP Section – only in Local mode */}
                  {interpretabilityMode === "local" && (
                    <div className="info-section">
                      <div
                        className="section-header"
                        style={{ display: "flex", justifyContent: "space-between" }}
                      >
                        <h4 style={{ margin: 0 }}>Partial Dependence Plots (PDPs)</h4>
                        <div>
                          <select
                            onChange={(e) => {
                              const selectedFeature = e.target.value;
                              if (selectedFeature) {
                                scrollToFeature(`training-${index + 1}-pdp-feature-${selectedFeature}`);
                              }
                            }}
                          >
                            <option value="">Jump to feature...</option>
                            {allPdpFeatures.map((feat) => (
                              <option key={feat} value={feat}>
                                {feat}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {pdp_plots.plots[0].data.map((featureItem) => {
                        const featureName = featureItem.feature;
                        return (
                          <div
                            key={featureName}
                            id={`training-${index + 1}-pdp-feature-${featureName}`}
                            className="feature-section"
                          >
                            <h5 className="feature-title">{featureName}</h5>
                            {pdp_plots.plots.map((plotClass, classIdx) => {
                              const featureData = plotClass.data.find((f) => f.feature === featureName);
                              if (!featureData) return null;
                              const pdpInterpretations = interpretPdpSegments(featureData);
                              return (
                                <div key={classIdx} className="class-row">
                                  <div className="plot-box">
                                    <h6>{plotClass.class_name}</h6>
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
                                        xaxis: { title: featureName },
                                        yaxis: { title: "Average Prediction" },
                                        title: `${featureName} - ${plotClass.class_name}`,
                                      }}
                                    />
                                  </div>
                                  <div className="interpretation-box">
                                    <h6>Interpretation</h6>
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
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </section>

        {/* About & User Guide */}
        <section id="about" className="info-section">
          <h2>About</h2>
          <p>
          This app allows users to upload datasets, train machine learning models, and visualize interpretability results such as SHAP and PDP plots.
          It provides clear insights into how different features influence model predictions, making the decision process more transparent.
          Overall, it bridges the gap between complex AI predictions and user understanding for more informed decision-making.
          </p>
        </section>
        <section id="user-guide" className="info-section">
          <h2>User Guide</h2>
          <ol>
            <li>
              <strong>Upload your classed dataset:</strong> Ensure your CSV files include
              the target variable (the value you want to predict). Click the
              <em>Choose File(s)</em> button and select one or more CSV files.
            </li>
            <li>
              <strong>Enter the target variable:</strong> In the text box, type the exact
              name of the column you want the model to predict. For example, if your
              CSVs have a column named <code>BTC_Close</code>, enter that.
            </li>
            <li>
              <strong>Train the model:</strong> Click <em>Submit</em>. The system will
              upload your files, train a machine learning model, and redirect you to the
              results page. There, you can view the interpretability plots (SHAP and PDP).
            </li>
            <li>
              <strong>Interpret the SHAP plots:</strong> 
              <ul>
                <li>
                  SHAP (SHapley Additive exPlanations) shows how each feature pushes the
                  prediction toward or away from a particular class.
                </li>
                <li>
                  If you see points above zero on the SHAP plot (e.g., when 
                  <code> BTC_High = 1</code>), it means the model is leaning toward
                  predicting that class for those data points.
                </li>
                <li>
                  Points below zero mean the feature is pushing the prediction away
                  from that class.
                </li>
              </ul>
              <div className="image-container">
                <img
                  src={userGuideSHAP}
                  alt="SHAP Plot Example"
                  style={{ maxWidth: "600px", width: "100%" }}
                />
                <p className="image-caption">
                  <em>Example SHAP plot where BTC_High=1 tends to increase the likelihood of predicting the target class.</em>
                </p>
              </div>
            </li>
            <li>
              <strong>Interpret the PDP plots:</strong>
              <ul>
                <li>
                  PDP (Partial Dependence Plot) shows how changing one feature (while
                  keeping others constant) affects the model’s predicted probability
                  for each class.
                </li>
                <li>
                  For instance, if <code>BTC_High</code> changes from 1 to 2 and the
                  plot shows a drop in predicted probability, it indicates that the model
                  becomes less likely to predict that class as <code>BTC_High</code> increases.
                </li>
              </ul>
              <div className="image-container">
                <img
                  src={userGuidePDP}
                  alt="PDP Plot Example"
                  style={{ maxWidth: "600px", width: "100%" }}
                />
                <p className="image-caption">
                  <em>Example PDP plot showing how the model’s predicted probability changes as BTC_High varies from 1 to 3.</em>
                </p>
              </div>
            </li>
          </ol>
        </section>
      </main>
    </div>
  );
}

export default HistoryPage;
