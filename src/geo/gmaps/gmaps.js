
// if google maps is not defined do not load the class
if(typeof(google) != "undefined" && typeof(google.maps) != "undefined") {

var DEFAULT_MAP_STYLE = [ { stylers: [ { saturation: -65 }, { gamma: 1.52 } ] },{ featureType: "administrative", stylers: [ { saturation: -95 }, { gamma: 2.26 } ] },{ featureType: "water", elementType: "labels", stylers: [ { visibility: "off" } ] },{ featureType: "administrative.locality", stylers: [ { visibility: "off" } ] },{ featureType: "road", stylers: [ { visibility: "simplified" }, { saturation: -99 }, { gamma: 2.22 } ] },{ featureType: "poi", elementType: "labels", stylers: [ { visibility: "off" } ] },{ featureType: "road.arterial", stylers: [ { visibility: "off" } ] },{ featureType: "road.local", elementType: "labels", stylers: [ { visibility: "off" } ] },{ featureType: "transit", stylers: [ { visibility: "off" } ] },{ featureType: "road", elementType: "labels", stylers: [ { visibility: "off" } ] },{ featureType: "poi", stylers: [ { saturation: -55 } ] } ];



cdb.geo.GoogleMapsMapView = cdb.geo.MapView.extend({

  layerTypeMap: {
    "tiled": cdb.geo.GMapsTiledLayerView,
    "cartodb": cdb.geo.GMapsCartoDBLayerView,
    "carto": cdb.geo.GMapsCartoDBLayerView,
    "plain": cdb.geo.GMapsPlainLayerView,
    "gmapsbase": cdb.geo.GMapsBaseLayerView
  },

  initialize: function() {
    _.bindAll(this, '_ready');
    this._isReady = false;
    var self = this;

    cdb.geo.MapView.prototype.initialize.call(this);

    var bounds = this.map.getViewBounds();
    if(bounds) {
      this.showBounds(bounds);
    }
    var center = this.map.get('center');
    if(!this.options.map_object) {
      this.map_googlemaps = new google.maps.Map(this.el, {
        center: new google.maps.LatLng(center[0], center[1]),
        zoom: this.map.get('zoom'),
        minZoom: this.map.get('minZoom'),
        maxZoom: this.map.get('maxZoom'),
        disableDefaultUI: true,
        mapTypeControl:false,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        backgroundColor: 'white'
      });
    } else {
      this.map_googlemaps = this.options.map_object;
      this.setElement(this.map_googlemaps.getDiv());
      // fill variables
      var c = self.map_googlemaps.getCenter();
      self._setModelProperty({ center: [c.lat(), c.lng()] });
      self._setModelProperty({ zoom: self.map_googlemaps.getZoom() });
      // unset bounds to not change mapbounds
      self.map.unset('view_bounds_sw', { silent: true });
      self.map.unset('view_bounds_ne', { silent: true });
    }


    this.map.geometries.bind('add', this._addGeometry, this);
    this.map.geometries.bind('remove', this._removeGeometry, this);


    this._bindModel();
    this._addLayers();

    google.maps.event.addListener(this.map_googlemaps, 'center_changed', function() {
        var c = self.map_googlemaps.getCenter();
        self._setModelProperty({ center: [c.lat(), c.lng()] });
    });

    google.maps.event.addListener(this.map_googlemaps, 'zoom_changed', function() {
      self._setModelProperty({
        zoom: self.map_googlemaps.getZoom()
      });
    });

    google.maps.event.addListener(this.map_googlemaps, 'click', function(e) {
        self.trigger('click', e, [e.latLng.lat(), e.latLng.lng()]);
    });

    google.maps.event.addListener(this.map_googlemaps, 'dblclick', function(e) {
        self.trigger('dblclick', e);
    });

    this.map.layers.bind('add', this._addLayer, this);
    this.map.layers.bind('remove', this._removeLayer, this);
    this.map.layers.bind('reset', this._addLayers, this);

    this.projector = new cdb.geo.CartoDBLayerGMaps.Projector(this.map_googlemaps);

    this.projector.draw = this._ready;

  },

  _ready: function() {
    this.projector.draw = function() {};
    this.trigger('ready');
    this._isReady = true;
  },

  _setZoom: function(model, z) {
    z = z || 0;
    this.map_googlemaps.setZoom(z);
  },

  _setCenter: function(model, center) {
    var c = new google.maps.LatLng(center[0], center[1]);
    this.map_googlemaps.setCenter(c);
  },

  createLayer: function(layer) {
    var layer_view,
        layerClass = this.layerTypeMap[layer.get('type').toLowerCase()];

    if (layerClass) {
      layer_view = new layerClass(layer, this.map_googlemaps);
    } else {
      cdb.log.error("MAP: " + layer.get('type') + " can't be created");
    }
    return layer_view;
  },

  _addLayer: function(layer, layers, opts) {
    opts = opts || {};
    var self = this;
    var lyr, layer_view;

    layer_view = this.createLayer(layer);

    if (!layer_view) {
      return;
    }

    this.layers[layer.cid] = layer_view;

    if (layer_view) {
      var idx = _.keys(this.layers).length  - 1;
      var isBaseLayer = idx === 0 || (opts && opts.index === 0);
      // set base layer
      if(isBaseLayer && !opts.no_base_layer) {
        var m = layer_view.model;
        if(m.get('type') == 'GMapsBase') {
          layer_view._update();
        } else {
          layer_view.isBase = true;
          layer_view._update();
        }
      } else {
        idx -= 1;
        idx = Math.max(0, idx); // avoid -1
        self.map_googlemaps.overlayMapTypes.setAt(idx, layer_view.gmapsLayer);
      }
      layer_view.index = idx;
      this.trigger('newLayerView', layer_view, this);
    } else {
      cdb.log.error("layer type not supported");
    }


    var attribution = layer.get('attribution');

    if (attribution) {
      // Setting attribution in map model
      // it doesn't persist in the backend, so this is needed.
      var attributions = this.map.get('attribution') || [];
      if (!_.contains(attributions, attribution)) {
        attributions.push(attribution);
      }

      this.map.set({ attribution: attributions });
    }

  },

  latLonToPixel: function(latlon) {
    return this.projector.latLngToPixel(new google.maps.LatLng(latlon[0], latlon[1]));
  },

  getSize: function() {
    return {
      x: this.$el.width(),
      y: this.$el.height()
    };
  },

  panBy: function(p) {
    var c = this.map.get('center');
    var pc = this.latLonToPixel(c);
    p.x += pc.x;
    p.y += pc.y;
    var ll = this.projector.pixelToLatLng(p);
    this.map.setCenter([ll.lat(), ll.lng()]);
  },

  getBounds: function() {
    if(this._isReady) {
      var b = this.map_googlemaps.getBounds();
      var sw = b.getSouthWest();
      var ne = b.getNorthEast();
      return [
        [sw.lat(), sw.lng()],
        [ne.lat(), ne.lng()]
      ];
    }
    return [ [0,0], [0,0] ];
  },

  setAttribution: function(m) {
    // Remove old one
    var old = document.getElementById("cartodb_attribution")
      , attribution = m.get("attribution").join(", ");

    // If div already exists, remove it
    if (old) {
      old.parentNode.removeChild(old);
    }

    // Add new one
    var container           = this.map_googlemaps.getDiv()
      , style               = "height: 19px; line-height: 19px; padding-right: 6px; padding-left: 50px; background:white; background: -webkit-linear-gradient(left, rgba(255, 255, 255, 0) 0px,\
                              rgba(255, 255, 255, 0.498039) 50px); background: linear-gradient(left, rgba(255, 255, 255, 0) 0px, rgba(255, 255, 255, 0.498039) 50px); background: \
                              -moz-inear-gradient(left, rgba(255, 255, 255, 0) 0px, rgba(255, 255, 255, 0.498039) 50px); font-family: Arial, sans-serif; font-size: 10px; color: rgb(68, 68, 68);\
                              white-space: nowrap; direction: ltr; text-align: right; background-position: initial initial; background-repeat: initial initial; position:absolute; bottom:19px;\
                              right:0; display:block; border:none; z-index:10000;"
      , cartodb_attribution = document.createElement("div");

    cartodb_attribution.setAttribute('id','cartodb_attribution');
    container.appendChild(cartodb_attribution);
    cartodb_attribution.setAttribute('style',style);
    cartodb_attribution.innerHTML = attribution;
  },

  setCursor: function(cursor) {
    this.map_googlemaps.setOptions({ draggableCursor: cursor });
  },

  _addGeomToMap: function(geom) {
    var geo = cdb.geo.GoogleMapsMapView.createGeometry(geom);
    if(geo.geom.length) {
      for(var i = 0 ; i < geo.geom.length; ++i) {
        geo.geom[i].setMap(this.map_googlemaps);
      }
    } else {
        geo.geom.setMap(this.map_googlemaps);
    }
    return geo;
  },

  _removeGeomFromMap: function(geo) {
    if(geo.geom.length) {
      for(var i = 0 ; i < geo.geom.length; ++i) {
        geo.geom[i].setMap(null);
      }
    } else {
      geo.geom.setMap(null);
    }
  },

  getNativeMap: function() {
    return this.map_googlemaps;
  },

  invalidateSize: function() {
    google.maps.event.trigger(this.map_googlemaps, 'resize');
  }

}, {

  /**
   * create the view for the geometry model
   */
  createGeometry: function(geometryModel) {
    if(geometryModel.isPoint()) {
      return new cdb.geo.gmaps.PointView(geometryModel);
    }
    return new cdb.geo.gmaps.PathView(geometryModel);
  }
});

}
