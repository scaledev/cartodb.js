/** Usage:
*
* Add Infowindow model:
*
* var infowindowModel = new cdb.geo.ui.InfowindowModel({
*   template_name: 'templates/map/infowindow',
*   latlng: [72, -45],
*   offset: [100, 10]
* });
*
* var infowindow = new cdb.geo.ui.Infowindow({
*   model: infowindowModel,
*   mapView: mapView
* });
*
* Show the infowindow:
* infowindow.showInfowindow();
*
*/

cdb.geo.ui.InfowindowModel = Backbone.Model.extend({
  defaults: {
    template_name: 'geo/infowindow',
    latlng: [0, 0],
    offset: [0, 0], // offset of the tip calculated from the bottom left corner
    autoPan: true,
    content: "",
    visibility: false,
    fields: null // contains the fields displayed in the infowindow
  },

  clearFields: function() {
    this.set({fields: []});
  },

  addField: function(fieldName) {
    if(!this.containsField(fieldName)) {
      var fields = _.clone(this.get('fields')) || [];
      fields.push(fieldName);
      this.set({'fields': fields});
    }
    return this;
  },

  containsField: function(fieldName) {
    var fields = this.get('fields') || [];
    return _.contains(fields, fieldName);
  },

  removeField: function(fieldName) {
    if(this.containsField(fieldName)) {
      var fields = _.clone(this.get('fields')) || [];
      var idx = _.indexOf(fields, fieldName);
      if(idx >= 0) {
        fields.splice(idx, 1);
      }
      this.set({'fields': fields});
    }
    return this;
  }

});

cdb.geo.ui.Infowindow = cdb.core.View.extend({
  className: "infowindow",

  initialize: function(){
    var self = this;

    _.bindAll(this, "render", "setLatLng", "changeTemplate", "_updatePosition", "_update", "toggle", "show", "hide");

    this.mapView = this.options.mapView;
    this.map     = this.mapView.map_leaflet;

    this.template = this.options.template ? this.options.template : cdb.templates.getTemplate(this.model.get("template_name"));

    this.add_related_model(this.model);

    this.model.bind('change:content', this.render, this);
    this.model.bind('change:template_name', this.changeTemplate, this);
    this.model.bind('change:latlng', this.render, this);
    this.model.bind('change:visibility', this.toggle, this);

    this.mapView.map.bind('change', this._updatePosition, this);
    //this.map.on('viewreset', this._updatePosition, this);
    this.map.on('drag', this._updatePosition, this);
    this.map.on('zoomstart', this.hide, this);
    this.map.on('zoomend', this.show, this);

    this.map.on('click', function() {
      self.model.set("visibility", false);
    });

    this.render();
    this.$el.hide();

  },

  changeTemplate: function(template_name) {

    this.template = cdb.templates.getTemplate(this.model.get("template_name"));
    this.render();

  },

  render: function() {
    this.$el.html($(this.template(this.model.toJSON())));
    this._update();

    return this;
  },

  toggle: function() {
    this.model.get("visibility") ? this.show() : this.hide();
  },

  /**
  * Set the correct position for the popup
  * @params {latlng} A new Leaflet LatLng object
  */
  setLatLng: function (latlng) {
    this.model.set("latlng", latlng);
    return this;
  },

  showInfowindow: function() {
    this.model.set("visibility", true);
  },

  show: function () {
    var that = this;

    if (this.model.get("visibility")) {
      that.$el.css({ left: -5000 });
      that.$el.fadeIn(250, function() {
        that._updatePosition();
      });
    }

  },

  isHidden: function () {
    return !this.model.get("visibility");
  },

  hide: function (force) {
    if (force || !this.model.get("visibility")) this.$el.fadeOut(250);
  },

  _update: function () {
    this._adjustPan();
    this._updatePosition();
  },

  /**
  * Update the position (private)
  */
  _updatePosition: function () {

    var offset = this.model.get("offset");

    var
    pos  = this.mapView.latLonToPixel(this.model.get("latlng")),
    left = pos.x - offset[0],
    top  = pos.y - this.$el.outerHeight(true) - offset[1];

    this.$el.css({ top: top, left: left });
  },

  _adjustPan: function () {

    var offset = this.model.get("offset");

    if (!this.model.get("autoPan")) { return; }

    var
    map             = this.map,
    x               = this.$el.position().left,
    y               = this.$el.position().top,
    containerHeight = this.$el.outerHeight(true),
    containerWidth  = this.$el.width(),
    layerPos        = new L.Point(x, y),
    pos             = this.mapView.latLonToPixel(this.model.get("latlng")),
    adjustOffset    = new L.Point(0, 0),
    size            = map.getSize();

    if (pos.x < containerWidth) {
      adjustOffset.x = pos.x  + offset[0]- containerWidth;
    }

    if (pos.x + containerWidth > size.x) {
      adjustOffset.x = pos.x + offset[0] + containerWidth - size.x;
    }

    if (pos.y <= containerHeight) {
      adjustOffset.y = pos.y - containerHeight;
    }

    if (pos.y - containerHeight > size.y) {
      adjustOffset.y = pos.y + containerHeight - size.y;
    }

    if (adjustOffset.x || adjustOffset.y) {
      map.panBy(adjustOffset);
    }
  },

});