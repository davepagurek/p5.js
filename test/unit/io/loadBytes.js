import { testSketchWithPromise, promisedSketch } from '../../js/p5_helpers';

suite('loadBytes', function() {
  var invalidFile = '404file';
  var validFile = 'unit/assets/nyan_cat.gif';

  testSketchWithPromise('error prevents sketch continuing', function(
    sketch,
    resolve,
    reject
  ) {
    sketch.preload = function() {
      sketch.loadBytes(invalidFile);
      setTimeout(resolve, 50);
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
      sketch.loadBytes(
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
      sketch.loadBytes(validFile);
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
      sketch.loadBytes(
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

  test('returns the correct object', async function() {
    const object = await promisedSketch(function(sketch, resolve, reject) {
      var _object;
      sketch.preload = function() {
        _object = sketch.loadBytes(validFile, function() {}, reject);
      };

      sketch.setup = function() {
        resolve(_object);
      };
    });
    assert.isObject(object);
    // Check data format
    expect(object.bytes).to.satisfy(function(v) {
      return Array.isArray(v) || v instanceof Uint8Array;
    });
    // Validate data
    var str = 'GIF89a';
    // convert the string to a byte array
    var rgb = str.split('').map(function(e) {
      return e.charCodeAt(0);
    });
    // this will convert a Uint8Aray to [], if necessary:
    var loaded = Array.prototype.slice.call(object.bytes, 0, str.length);
    assert.deepEqual(loaded, rgb);
  });

  test('passes an object to success callback for object JSON', async function() {
    const object = await promisedSketch(function(sketch, resolve, reject) {
      sketch.preload = function() {
        sketch.loadBytes(validFile, resolve, reject);
      };
    });
    assert.isObject(object);
    // Check data format
    expect(object.bytes).to.satisfy(function(v) {
      return Array.isArray(v) || v instanceof Uint8Array;
    });
    // Validate data
    var str = 'GIF89a';
    // convert the string to a byte array
    var rgb = str.split('').map(function(e) {
      return e.charCodeAt(0);
    });
    // this will convert a Uint8Aray to [], if necessary:
    var loaded = Array.prototype.slice.call(object.bytes, 0, str.length);
    assert.deepEqual(loaded, rgb);
  });
});
