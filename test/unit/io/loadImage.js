import p5 from '../../../src/app.js';
import { testSketchWithPromise, promisedSketch } from '../../js/p5_helpers';

suite('loadImage', function() {
  var invalidFile = '404file';
  var validFile = 'unit/assets/nyan_cat.gif';

  testSketchWithPromise('error prevents sketch continuing', function(
    sketch,
    resolve,
    reject
  ) {
    sketch.preload = function() {
      sketch.loadImage(invalidFile);
      setTimeout(resolve(), 50);
    };

    sketch.setup = function() {
      reject(new Error('Setup called'));
    };

    sketch.draw = function() {
      reject(new Error('Draw called'));
    };
  });

  testSketchWithPromise('error callback is called', function(
    sketch,
    resolve,
    reject
  ) {
    sketch.preload = function() {
      sketch.loadImage(
        invalidFile,
        function() {
          reject(new Error('Success callback executed.'));
        },
        function() {
          // Wait a bit so that if both callbacks are executed we will get an error.
          setTimeout(resolve, 50);
        }
      );
    };
  });

  testSketchWithPromise('loading correctly triggers setup', function(
    sketch,
    resolve,
    reject
  ) {
    sketch.preload = function() {
      sketch.loadImage(validFile);
    };

    sketch.setup = function() {
      resolve();
    };
  });

  testSketchWithPromise('success callback is called', function(
    sketch,
    resolve,
    reject
  ) {
    var hasBeenCalled = false;
    sketch.preload = function() {
      sketch.loadImage(
        validFile,
        function() {
          hasBeenCalled = true;
        },
        function(err) {
          reject(new Error('Error callback was entered: ' + err));
        }
      );
    };

    sketch.setup = function() {
      if (!hasBeenCalled) {
        reject(new Error('Setup called prior to success callback'));
      } else {
        setTimeout(resolve, 50);
      }
    };
  });

  test('returns an object with correct data', async function() {
    const image = await promisedSketch(function(sketch, resolve, reject) {
      var _image;
      sketch.preload = function() {
        _image = sketch.loadImage(validFile, function() {}, reject);
      };

      sketch.setup = function() {
        resolve(_image);
      };
    });
    assert.instanceOf(image, p5.Image);
  });

  test('passes an object with correct data to callback', async function() {
    const image = await promisedSketch(function(sketch, resolve, reject) {
      sketch.preload = function() {
        sketch.loadImage(validFile, resolve, reject);
      };
    });
    assert.instanceOf(image, p5.Image);
  });
});
