looker.plugins.visualizations.add({
  id: "hello_world",
  label: "Hello World",
  options: {
    color: {
      type: "string",
      label: "Text Color",
      default: "black"
    }
  },
  create: function(element, config){
    element.innerHTML = "<h1>Hello World</h1>";
  },
  updateAsync: function(data, element, config, queryResponse, details, done){
    element.innerHTML = "<h1 style='color:" + config.color + "'>Hello World</h1>";
    done();
  }
});
