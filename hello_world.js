looker.plugins.visualizations.add({
  id: "progress_bar",
  label: "Basic Progress Bar",
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
        .progress-container {
          width: 100%;
          background-color: #f3f3f3;
          border-radius: 5px;
          overflow: hidden;
          height: 30px;
          display: flex;
          align-items: center;
        }
        .progress-bar {
          height: 100%;
          text-align: center;
          color: white;
          line-height: 30px; /* Vertically center the text */
          white-space: nowrap;
          transition: width 0.5s;
        }
        .progress-text-large {
          font-size: 18px;
        }
        .progress-text-small {
          font-size: 12px;
        }
      </style>
    `;

    // Create container
    var container = element.appendChild(document.createElement("div"));
    container.className = "progress-container";

    // Create the bar
    this._progressBar = container.appendChild(document.createElement("div"));
    this._progressBar.className = "progress-bar";
  },
  updateAsync: function(data, element, config, queryResponse, details, done) {
    this.clearErrors();

    if (queryResponse.fields.measures.length == 0) {
      this.addError({title: "No Measures", message: "This chart requires at least one measure."});
      return;
    }

    // Get the first measure's value
    var firstRow = data[0];
    var firstCell = firstRow[queryResponse.fields.measures[0].name];
    var value = LookerCharts.Utils.textForCell(firstCell);

    // Try to parse it to a number
    var percent = parseFloat(value);
    if (isNaN(percent)) {
      this.addError({title: "Invalid Data", message: "The first measure must be a number (0-100)."});
      return;
    }

    // Clamp value between 0 and 100
    percent = Math.max(0, Math.min(100, percent));

    // Set bar color
    this._progressBar.style.backgroundColor = config.bar_color || "#4CAF50";

    // Set width and text
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
