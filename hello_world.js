looker.plugins.visualizations.add({
  id: "progress_bar",
  label: "Labeled Progress Bar",
  options: {
    bar_color: {
      type: "string",
      label: "Bar Color",
      default: "#4CAF50"
    },
    font_size: {
      type: "string",
      label: "Font Size",
      values: [
        {"Large": "large"},
        {"Small": "small"}
      ],
      display: "radio",
      default: "large"
    }
  },
  create: function(element, config) {
    element.innerHTML = `
      <style>
        .progress-wrapper {
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          font-family: sans-serif;
          padding: 10px;
        }
        .progress-title {
          margin-bottom: 8px;
          font-size: 16px;
          font-weight: bold;
          text-align: center;
        }
        .progress-container {
          width: 100%;
          background-color: #f3f3f3;
          border-radius: 5px;
          overflow: hidden;
          height: 30px;
          display: flex;
          align-items: center;
          position: relative;
        }
        .progress-bar {
          height: 100%;
          text-align: center;
          color: white;
          line-height: 30px;
          white-space: nowrap;
          transition: width 0.5s;
        }
        .progress-text-large {
          font-size: 18px;
        }
        .progress-text-small {
          font-size: 12px;
        }
        .progress-scale {
          width: 100%;
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          margin-top: 5px;
          color: #666;
        }
      </style>
    `;

    // Create wrapper
    const wrapper = element.appendChild(document.createElement("div"));
    wrapper.className = "progress-wrapper";

    // Title
    this._title = wrapper.appendChild(document.createElement("div"));
    this._title.className = "progress-title";
    this._title.innerText = "Progress"; // Default label

    // Progress container
    const container = wrapper.appendChild(document.createElement("div"));
    container.className = "progress-container";

    // Progress bar
    this._progressBar = container.appendChild(document.createElement("div"));
    this._progressBar.className = "progress-bar";

    // Scale labels
    this._scale = wrapper.appendChild(document.createElement("div"));
    this._scale.className = "progress-scale";
    this._scale.innerHTML = `<span>0%</span><span>100%</span>`;
  },
  updateAsync: function(data, element, config, queryResponse, details, done) {
    this.clearErrors();

    if (queryResponse.fields.measures.length === 0) {
      this.addError({title: "No Measures", message: "This chart requires at least one measure."});
      return;
    }

    // Get the first measure
    const firstRow = data[0];
    const measureName = queryResponse.fields.measures[0].name;
    const measureValue = firstRow[measureName];
    let percent = parseFloat(LookerCharts.Utils.textForCell(measureValue));

    if (isNaN(percent)) {
      this.addError({title: "Invalid Data", message: "The first measure must be a number (0-100)."});
      return;
    }

    percent = Math.max(0, Math.min(100, percent));

    // Get the first dimension (if available) for the title
    let titleText = "Progress";
    if (queryResponse.fields.dimensions.length > 0) {
      const dimensionName = queryResponse.fields.dimensions[0].name;
      const dimensionValue = firstRow[dimensionName];
      titleText = LookerCharts.Utils.textForCell(dimensionValue);
    }
    this._title.innerText = titleText;

    // Update the bar
    this._progressBar.style.backgroundColor = config.bar_color || "#4CAF50";
    this._progressBar.style.width = percent + "%";
    this._progressBar.innerText = percent + "%";

    // Set font size
    if (config.font_size === "small") {
      this._progressBar.className = "progress-bar progress-text-small";
    } else {
      this._progressBar.className = "progress-bar progress-text-large";
    }

    done();
  }
});

