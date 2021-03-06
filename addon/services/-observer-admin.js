import Service from '@ember/service';
import { bind } from '@ember/runloop';

// WeakMap { root: { elements: [{ element, enterCallback, exitCallback }], IntersectionObserver } }
let DOMRef = new WeakMap();

/**
 * Static administrator to ensure use one IntersectionObserver per viewport
 * Use `root` (viewport) as lookup property
 * `root` will have one IntersectionObserver with many entries (elements) to watch
 * provided callback will ensure consumer of this service is able to react to enter or exit
 * of intersection observer
 *
 * @module Ember.Service
 * @class ObserverAdmin
 */
export default class ObserverAdmin extends Service {
  /**
   * adds element to observe entries of IntersectionObserver
   *
   * @method add
   * @param {Node} element
   * @param {Function} enterCallback
   * @param {Function} exitCallback
   * @param {Object} options
   */
  add(element, enterCallback, exitCallback, options) {
    let { root = window } = options;
    let { elements, intersectionObserver } = this._findRoot(root);

    if (elements && elements.length > 0) {
      elements.push({ element, enterCallback, exitCallback });
      intersectionObserver.observe(element, options);
    } else {
      let newIO = new IntersectionObserver(bind(this, this._setupOnIntersection(root)), options);
      newIO.observe(element);
      DOMRef.set(root, { elements: [{ element, enterCallback, exitCallback }], intersectionObserver: newIO });
    }
  }

  /**
   * @method unobserve
   * @param {Node} element
   * @param {Node|window} root
   */
  unobserve(element, root) {
    let { intersectionObserver } = this._findRoot(root);
    if (intersectionObserver) {
      intersectionObserver.unobserve(element);
    }
  }

  /**
   * to unobserver multiple elements
   *
   * @method disconnect
   * @param {Node|window} root
   */
  disconnect(root) {
    let { intersectionObserver } = this._findRoot(root);
    if (intersectionObserver) {
      intersectionObserver.disconnect();
    }
  }

  _setupOnIntersection(root) {
    return function(entries) {
      return this._onAdminIntersection(root, entries);
    }
  }

  _onAdminIntersection(root, ioEntries) {
    ioEntries.forEach((entry) => {

      let { isIntersecting, intersectionRatio } = entry;

      // first determine if entry intersecting
      if (isIntersecting) {
        // then find entry's callback in static administration
        let { elements = [] } = this._findRoot(root);

        elements.some(({ element, enterCallback }) => {
          if (element === entry.target) {
            // call entry's enter callback
            enterCallback();
            return true;
          }
        });
      } else if (intersectionRatio <= 0) { // exiting viewport
        // then find entry's callback in static administration
        let { elements = [] } = this._findRoot(root);

        elements.some(({ element, exitCallback }) => {
          if (element === entry.target) {
            // call entry's exit callback
            exitCallback();
            return true;
          }
        });
      }
    });
  }

  _findRoot(root) {
    return DOMRef.get(root) || {};
  }
}
