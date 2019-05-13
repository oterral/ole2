import Control from './control';
import image from '../../img/modify_geometry.svg';

// Return an array of styles
const getStyles = (style, feature) => {
  if (!style) {
    return [];
  }
  let styles = style;
  if (typeof style === 'function') {
    if (feature) {
      // styleFunction
      styles = style(feature);
    } else {
      // featureStyleFunction
      styles = style();
    }
  }
  return Array.isArray(styles) ? styles : [styles];
};

/**
 * Control for modifying geometries.
 * @extends {ole.Control}
 * @alias ole.ModifyControl
 */
class ModifyControl extends Control {
  /**
   * @param {Object} [options] Tool options.
   * @param {string} [options.type] Geometry type ('Point', 'LineString', 'Polygon',
   *   'MultiPoint', 'MultiLineString', 'MultiPolygon' or 'Circle').
   *   Default is 'Point'.
   * @param {ol.Collection<ol.Feature>} [options.features] Destination for drawing.
   * @param {ol.source.Vector} [options.source] Destination for drawing.
   * @param {ol.style.Style.StyleLike} [options.style] Style used when a feature is selected.
   * @param {ol.style.Style.StyleLike} [options.modifyStyle] Style used by the Modify interaction.
   */
  constructor(options) {
    super(Object.assign({
      title: 'Modify geometry',
      className: 'ole-control-modify',
      image,
    }, options));

    /**
     * @type {ol.Coordinate}
     * @private
     */
    this.coordinate = null;

    /**
     * @type {string}
     * @private
     */
    this.previousCursor = null;

    this.selectStyle = options.style;

    this.selectInteraction = new ol.interaction.Select({
      layers: this.layerFilter,
      features: this.features,
      style: this.selectStyle,
    });

    if (options.style) {
      window.console.log(this.selectInteraction.getFeatures());
      // Apply the select style dynamically when the feature has its own style.
      this.selectInteraction.getFeatures().on('add', (evt) => {
        this.feature = evt.element;
        this.editor.setEditFeature(this.feature);
        this.setModifyActive();

        // Apply the select style dynamically when the feature has its own style.
        if (this.feature && this.feature.getStyleFunction() && this.selectStyle) {
          const featureStyles = getStyles(this.feature.getStyleFunction());
          const selectStyles = getStyles(this.selectStyle, this.feature);
          this.feature.setStyle(featureStyles.concat(selectStyles));
        }
      });

      // Remove the select style dynamically when the feature had its own style.
      this.selectInteraction.getFeatures().on('selected', () => {
        if (this.feature.getStyleFunction() && this.selectStyle) {
          const styles = getStyles(this.feature.getStyleFunction(), null);
          const selectStyles = getStyles(this.selectStyle, this.feature);
          this.feature.setStyle(styles.slice(0, styles.indexOf(selectStyles[0])));
        }

        this.setModifyActive();
        this.editor.setEditFeature(null);
        this.feature = null;
      });
    }

    /**
     * @type {ol.interaction.Modify}
     * @private
     */
    this.modifyInteraction = new ol.interaction.Modify({
      features: this.selectInteraction.getFeatures(),
      style: options.modifyStyle,
    });

    /**
     * @type {ol.interaction.Pointer}
     * @private
     */
    this.moveInteraction = new ol.interaction.Pointer({
      handleDownEvent: this.startMoveFeature.bind(this),
      handleDragEvent: this.moveFeature.bind(this),
      handleUpEvent: this.stopMoveFeature.bind(this),
      handleMoveEvent: this.setModifyActive.bind(this),
    });
  }

  /**
   * Handle the event of the delete event listener.
   * @param {Event} evt Event.
   * @private
   */
  deleteFeature(evt) {
    if (evt.key === 'Delete' && this.feature) {
      this.source.removeFeature(this.feature);
      this.selectInteraction.getFeatures().clear();
    }
  }

  /**
   * Handle the down event of the move interaction.
   * @param {ol.MapBrowserEvent} evt Event.
   * @private
   */
  startMoveFeature(evt) {
    if (this.feature && this.modifyActive === false) {
      if (this.feature.getGeometry() instanceof ol.geom.Point) {
        const extent = this.feature.getGeometry().getExtent();
        this.coordinate = ol.extent.getCenter(extent);
      } else {
        this.coordinate = evt.coordinate;
      }
      return true;
    }

    return false;
  }

  /**
   * Handle the drag event of the move interaction.
   * @param {ol.MapBrowserEvent} evt Event.
   * @private
   */
  moveFeature(evt) {
    if (this.modifyActive === false) {
      const deltaX = evt.coordinate[0] - this.coordinate[0];
      const deltaY = evt.coordinate[1] - this.coordinate[1];

      this.feature.getGeometry().translate(deltaX, deltaY);
      this.coordinate = evt.coordinate;
    }
  }

  /**
   * Handle the up event of the pointer interaction.
   * @param {ol.MapBrowserEvent} evt Event.
   * @private
   */
  stopMoveFeature() {
    this.coordinate = null;
    return false;
  }

  /**
   * Handle the move event of the move interaction.
   * @private
   */
  setModifyActive() {
    window.console.log(this.selectInteraction.getFeatures().getLength());
    window.console.log(this.modifyInteraction.getOverlay().getSource().getFeatures().length);
    this.modifyActive = this.modifyInteraction.getOverlay()
      .getSource().getFeatures().length > 0;
  }

  /**
   * Handle the move event of the move interaction.
   * @param {ol.MapBrowserEvent} evt Event.
   * @private
   */
  selectFeature(evt) {
    if (this.feature) {
      // Remove the select style dynamically when the feature had its own style.
      if (this.feature.getStyleFunction()) {
        const styles = getStyles(this.feature.getStyleFunction(), null);
        const selectStyles = getStyles(this.selectStyle, this.feature);
        this.feature.setStyle(styles.slice(0, styles.indexOf(selectStyles[0])));
      }
    }

    this.feature = evt.map.forEachFeatureAtPixel(evt.pixel, (f) => {
      if (this.source.getFeatures().indexOf(f) > -1) {
        return f;
      }
      return null;
    });

    // Apply the select style dynamically when the feature has its own style.
    if (this.feature && this.feature.getStyleFunction()) {
      const featureStyles = getStyles(this.feature.getStyleFunction());
      const selectStyles = getStyles(this.selectStyle, this.feature);
      this.feature.setStyle(featureStyles.concat(selectStyles));
    }


    this.editor.setEditFeature(this.feature);
    this.modifyActive = this.modifyInteraction.getOverlay()
      .getSource().getFeatures().length > 0;

    if (this.modifyActive) {
      this.changeCursor('grab');
    } else if (this.feature) {
      this.changeCursor('move');
    } else if (this.previousCursor !== null) {
      this.changeCursor(this.previousCursor);
      this.previousCursor = null;
    }
  }

  /**
   * Change cursor style.
   * @param {string} cursor New cursor name.
   * @private
   */
  changeCursor(cursor) {
    const element = this.map.getTargetElement();
    if (element.style.cursor !== cursor) {
      if (this.previousCursor === null) {
        this.previousCursor = element.style.cursor;
      }
      element.style.cursor = cursor;
    }
  }

  /**
   * @inheritdoc
   */
  activate() {
    document.addEventListener('keydown', this.deleteFeature.bind(this));
    this.map.addInteraction(this.modifyInteraction);
    this.map.addInteraction(this.moveInteraction);
    this.map.addInteraction(this.selectInteraction);
    super.activate();
  }

  /**
   * @inheritdoc
   */
  deactivate(silent) {
    this.selectInteraction.getFeatures().clear();
    document.removeEventListener('keydown', this.deleteFeature.bind(this));
    this.map.removeInteraction(this.modifyInteraction);
    this.map.removeInteraction(this.moveInteraction);
    this.map.removeInteraction(this.selectInteraction);
    super.deactivate(silent);
  }
}

export default ModifyControl;
