// import React, { useState } from "react";
// import { useNavigate } from "react-router-dom";
// import axios from "axios";
// import { auth, db } from "./firebase";
// import { collection, addDoc } from "firebase/firestore";
// import "./HomePage.css";
// import girl from "./girl.png";

// import userGuideSHAP from "./UserGuideSHAP.png";
// import userGuidePDP from "./UserGuidePDP.png";


// function HomePage() {
//   const [selectedFiles, setSelectedFiles] = useState([]);
//   const [predictionVar, setPredictionVar] = useState("");
//   const [loading, setLoading] = useState(false);
//   const navigate = useNavigate();

//   const handleFileChange = (e) => {
//     const files = Array.from(e.target.files);
//     setSelectedFiles(files);
//     console.log("Files selected:", files);
//   };

//   const handleSubmit = async () => {
//     if (selectedFiles.length === 0 || !predictionVar) {
//       alert("Please select at least one CSV file and enter a prediction variable.");
//       return;
//     }

//     setLoading(true);
//     const formData = new FormData();
//     selectedFiles.forEach((file) => formData.append("files", file));
//     formData.append("prediction_variable", predictionVar);

//     try {
//       const response = await axios.post("http://localhost:5000/upload", formData, {
//         headers: { "Content-Type": "multipart/form-data" },
//       });

//       // Prepare the training result object from the backend response.
//       const newTrainingResult = {
//         shap_plots: response.data.shap_plots,
//         pdp_plots: response.data.pdp_plots,
//         accuracy: response.data.accuracy,
//         classification_report: response.data.classification_report,
//         timestamp: new Date().toISOString(),
//       };

//       // Save the training result to Firebase under the current user's "trainings" subcollection.
//       const user = auth.currentUser;
//       if (user) {
//         const trainingsRef = collection(db, "user_data", user.uid, "trainings");
//         await addDoc(trainingsRef, newTrainingResult);
//       }

//       // Prepare model download data (if available)
//       const modelPklB64 = response.data.model_pkl_b64 || null;
//       const modelFileName = response.data.shap_plots
//         ? `${response.data.shap_plots.target_variable}.pkl`
//         : "model.pkl";

//       // Slight delay for a smooth transition before navigation.
//       setTimeout(() => {
//         navigate("/results", {
//           state: { trainingResult: newTrainingResult, modelPklB64, modelFileName },
//         });
//       }, 1000);
//     } catch (error) {
//       console.error("Error uploading files:", error);
//       alert("Error uploading files. Please check your CSV format and try again.");
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="homepage-container">
//       <header className="navbar">
//         <div className="navbar-title">
//           <h1>My ML App</h1>
//         </div>
//         <nav className="navbar-links">
//           <a href="#home">Home</a>
//           <a href="#about">About</a>
//           <a href="#user-guide">User Guide</a>
//           <a href="#previous-records" onClick={() => navigate("/history")}>
//             Previous Records
//           </a>
//           <button className="logout-btn" onClick={() => navigate("/")}>
//             Log Out
//           </button>
//         </nav>
//       </header>

//       <main>
//         <section className="upload-section">
//           <h2>Upload CSV &amp; Enter Prediction Variable</h2>
//           <div className="upload-flex">
//             <div className="upload-controls">
//               <div className="upload-row">
//                 <label className="choose-file-btn">
//                   Choose File(s)
//                   <input
//                     type="file"
//                     multiple
//                     onChange={handleFileChange}
//                     style={{ display: "none" }}
//                     accept=".csv"
//                   />
//                 </label>
//                 <input
//                   type="text"
//                   className="variable-input"
//                   placeholder="Enter Variable to Predict"
//                   value={predictionVar}
//                   onChange={(e) => setPredictionVar(e.target.value)}
//                 />
//               </div>
//               {selectedFiles.length > 0 && (
//                 <p className="file-count">{selectedFiles.length} file(s) selected</p>
//               )}
//               <div className="submit-row">
//                 <button onClick={handleSubmit}>Submit</button>
//               </div>
//             </div>
//             <div className="upload-image">
//               <img src={girl} alt="Woman working on laptop" />
//             </div>
//           </div>
//         </section>

//         <section id="about" className="info-section">
//           <h2>About</h2>
//           <p>
//           This app allows users to upload datasets, train machine learning models, and visualize interpretability results such as SHAP and PDP plots.
//           It provides clear insights into how different features influence model predictions, making the decision process more transparent.
//           Overall, it bridges the gap between complex AI predictions and user understanding for more informed decision-making.
//           </p>
//         </section>

//         <section id="user-guide" className="info-section">
//           <h2>User Guide</h2>
//           <ol>
//             <li>
//               <strong>Upload your classed dataset:</strong> Ensure your CSV files include
//               the target variable (the value you want to predict). Click the
//               <em>Choose File(s)</em> button and select one or more CSV files.
//             </li>
//             <li>
//               <strong>Enter the target variable:</strong> In the text box, type the exact
//               name of the column you want the model to predict. For example, if your
//               CSVs have a column named <code>BTC_Close</code>, enter that.
//             </li>
//             <li>
//               <strong>Train the model:</strong> Click <em>Submit</em>. The system will
//               upload your files, train a machine learning model, and redirect you to the
//               results page. There, you can view the interpretability plots (SHAP and PDP).
//             </li>
//             <li>
//               <strong>Interpret the SHAP plots:</strong> 
//               <ul>
//                 <li>
//                   SHAP (SHapley Additive exPlanations) shows how each feature pushes the
//                   prediction toward or away from a particular class.
//                 </li>
//                 <li>
//                   If you see points above zero on the SHAP plot (e.g., when 
//                   <code> BTC_High = 1</code>), it means the model is leaning toward
//                   predicting that class for those data points.
//                 </li>
//                 <li>
//                   Points below zero mean the feature is pushing the prediction away
//                   from that class.
//                 </li>
//               </ul>
//               <div className="image-container">
//                 <img
//                   src={userGuideSHAP}
//                   alt="SHAP Plot Example"
//                   style={{ maxWidth: "600px", width: "100%" }}
//                 />
//                 <p className="image-caption">
//                   <em>Example SHAP plot where BTC_High=1 tends to increase the likelihood of predicting the target class.</em>
//                 </p>
//               </div>
//             </li>
//             <li>
//               <strong>Interpret the PDP plots:</strong>
//               <ul>
//                 <li>
//                   PDP (Partial Dependence Plot) shows how changing one feature (while
//                   keeping others constant) affects the model’s predicted probability
//                   for each class.
//                 </li>
//                 <li>
//                   For instance, if <code>BTC_High</code> changes from 1 to 2 and the
//                   plot shows a drop in predicted probability, it indicates that the model
//                   becomes less likely to predict that class as <code>BTC_High</code> increases.
//                 </li>
//               </ul>
//               <div className="image-container">
//                 <img
//                   src={userGuidePDP}
//                   alt="PDP Plot Example"
//                   style={{ maxWidth: "600px", width: "100%" }}
//                 />
//                 <p className="image-caption">
//                   <em>Example PDP plot showing how the model’s predicted probability changes as BTC_High varies from 1 to 3.</em>
//                 </p>
//               </div>
//             </li>
//           </ol>
//         </section>

//       </main>

//       {/* Loading Popup Modal */}
//       {loading && (
//         <div className="loading-modal">
//           <div className="loading-content">
//             <div className="spinner"></div>
//             <p>Your model is being trained, please wait...</p>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }

// export default HomePage;








import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { auth, db } from "./firebase";
import { collection, addDoc } from "firebase/firestore";
import "./HomePage.css";
import girl from "./girl.png";

import userGuideSHAP from "./UserGuideSHAP.png";
import userGuidePDP from "./UserGuidePDP.png";

function HomePage() {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [predictionVar, setPredictionVar] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    setSelectedFiles(files);
    console.log("Files selected:", files);
  };

  const handleSubmit = async () => {
    if (selectedFiles.length === 0 || !predictionVar) {
      alert("Please select at least one CSV file and enter a prediction variable.");
      return;
    }

    setLoading(true);
    const formData = new FormData();
    selectedFiles.forEach((file) => formData.append("files", file));
    formData.append("prediction_variable", predictionVar);

    try {
      // Use the environment variable for the API URL.
      const apiURL = process.env.REACT_APP_API_URL || "http://localhost:5000";
      const response = await axios.post(`${apiURL}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      // Prepare the training result object from the backend response.
      const newTrainingResult = {
        shap_plots: response.data.shap_plots,
        pdp_plots: response.data.pdp_plots,
        accuracy: response.data.accuracy,
        classification_report: response.data.classification_report,
        timestamp: new Date().toISOString(),
      };

      // Save the training result to Firebase under the current user's "trainings" subcollection.
      const user = auth.currentUser;
      if (user) {
        const trainingsRef = collection(db, "user_data", user.uid, "trainings");
        await addDoc(trainingsRef, newTrainingResult);
      }

      // Prepare model download data (if available)
      const modelPklB64 = response.data.model_pkl_b64 || null;
      const modelFileName = response.data.shap_plots
        ? `${response.data.shap_plots.target_variable}.pkl`
        : "model.pkl";

      // Slight delay for a smooth transition before navigation.
      setTimeout(() => {
        navigate("/results", {
          state: { trainingResult: newTrainingResult, modelPklB64, modelFileName },
        });
      }, 1000);
    } catch (error) {
      console.error("Error uploading files:", error);
      alert("Error uploading files. Please check your CSV format and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="homepage-container">
      <header className="navbar">
        <div className="navbar-title">
          <h1>My ML App</h1>
        </div>
        <nav className="navbar-links">
          <a href="#home">Home</a>
          <a href="#about">About</a>
          <a href="#user-guide">User Guide</a>
          <a href="#previous-records" onClick={() => navigate("/history")}>
            Previous Records
          </a>
          <button className="logout-btn" onClick={() => navigate("/")}>
            Log Out
          </button>
        </nav>
      </header>

      <main>
        <section className="upload-section">
          <h2>Upload CSV &amp; Enter Prediction Variable</h2>
          <div className="upload-flex">
            <div className="upload-controls">
              <div className="upload-row">
                <label className="choose-file-btn">
                  Choose File(s)
                  <input
                    type="file"
                    multiple
                    onChange={handleFileChange}
                    style={{ display: "none" }}
                    accept=".csv"
                  />
                </label>
                <input
                  type="text"
                  className="variable-input"
                  placeholder="Enter Variable to Predict"
                  value={predictionVar}
                  onChange={(e) => setPredictionVar(e.target.value)}
                />
              </div>
              {selectedFiles.length > 0 && (
                <p className="file-count">{selectedFiles.length} file(s) selected</p>
              )}
              <div className="submit-row">
                <button onClick={handleSubmit}>Submit</button>
              </div>
            </div>
            <div className="upload-image">
              <img src={girl} alt="Woman working on laptop" />
            </div>
          </div>
        </section>

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
                  <code>BTC_High = 1</code>), it means the model is leaning toward
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

      {/* Loading Popup Modal */}
      {loading && (
        <div className="loading-modal">
          <div className="loading-content">
            <div className="spinner"></div>
            <p>Your model is being trained, please wait...</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default HomePage;
