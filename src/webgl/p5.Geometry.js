/**
 * @module Shape
 * @submodule 3D Primitives
 * @for p5
 * @requires core
 * @requires p5.Geometry
 */

//some of the functions are adjusted from Three.js(http://threejs.org)

import p5 from '../core/main';
/**
 * p5 Geometry class
 * @class p5.Geometry
 * @constructor
 * @param  {Integer} [detailX] number of vertices along the x-axis.
 * @param  {Integer} [detailY] number of vertices along the y-axis.
 * @param {function} [callback] function to call upon object instantiation.
 */
p5.Geometry = class  {
  constructor(detailX, detailY, callback){
  //an array containing every vertex
  //@type [p5.Vector]
    this.vertices = [];

    // In WebGL2 mode, we will use instanced rendering to draw lines, using
    // a separate data layout for segments, caps, and joins. In WebGL1 mode,
    // we manually duplicate data into one big buffer.
    this.lineData = {};
    for (const key of ['segments', 'caps', 'joins', 'stroke']) {
      const data = {};

      data.count = 0;

      //an array containing every vertex for stroke drawing
      data.lineVertices = [];

      // The tangents going into or out of a vertex on a line. Along a straight
      // line segment, both should be equal. At an endpoint, one or the other
      // will not exist and will be all 0. In joins between line segments, they
      // may be different, as they will be the tangents on either side of the join.
      data.lineTangentsIn = [];
      data.lineTangentsOut = [];

      // One color per line vertex, generated automatically based on
      // vertexStrokeColors in _edgesToVertices()
      data.lineVertexColors = [];

      this.lineData[key] = data;
    }

    // When drawing lines with thickness, entries in this buffer represent which
    // side of the centerline the vertex will be placed. The sign of the number
    // will represent the side of the centerline, and the absolute value will be
    // used as an enum to determine which part of the cap or join each vertex
    // represents. See the doc comments for _addCap and _addJoin for diagrams.
    this.lineData.segments.lineSides = [1, -1, 3, 3, -1, -3];
    this.lineData.caps.lineSides = [-1, -2, 2, 2, 1, -1];
    this.lineData.joins.lineSides = [
      -1, -2, -3, -1, -3, 0,
      1, 2, 3, 1, 3, 0
    ];
    this.lineData.stroke.lineSides = [];

    //an array containing 1 normal per vertex
    //@type [p5.Vector]
    //[p5.Vector, p5.Vector, p5.Vector,p5.Vector, p5.Vector, p5.Vector,...]
    this.vertexNormals = [];
    //an array containing each three vertex indices that form a face
    //[[0, 1, 2], [2, 1, 3], ...]
    this.faces = [];
    //a 2D array containing uvs for every vertex
    //[[0.0,0.0],[1.0,0.0], ...]
    this.uvs = [];
    // a 2D array containing edge connectivity pattern for create line vertices
    //based on faces for most objects;
    this.edges = [];
    this.vertexColors = [];

    // One color per vertex representing the stroke color at that vertex
    this.vertexStrokeColors = [];

    this.detailX = detailX !== undefined ? detailX : 1;
    this.detailY = detailY !== undefined ? detailY : 1;
    this.dirtyFlags = {};
    this.webgl1StrokeDataDirty = true;

    if (callback instanceof Function) {
      callback.call(this);
    }
    return this; // TODO: is this a constructor?
  }

  reset() {
    for (const key in this.lineData) {
      this.lineData[key].count = 0;
      this.lineData[key].lineVertices.length = 0;
      this.lineData[key].lineTangentsIn.length = 0;
      this.lineData[key].lineTangentsOut.length = 0;
      this.lineData[key].lineVertexColors.length = 0;
    }

    this.webgl1StrokeDataDirty = true;
    this.vertices.length = 0;
    this.edges.length = 0;
    this.vertexColors.length = 0;
    this.vertexStrokeColors.length = 0;
    this.vertexNormals.length = 0;
    this.uvs.length = 0;

    this.dirtyFlags = {};
  }

  /**
   * Used in WebGL1 mode when instanced rendering is not available. To draw
   * strokes without instanced rendering, we manually duplicate vertices on
   * the CPU. This will be slower but will at least work.
   */
  _makeStrokeBufferData() {
    if (!this.webgl1StrokeDataDirty) return;

    const strokeData = this.lineData.stroke;
    for (const key of ['joins', 'caps', 'segments']) {
      const instanceData = this.lineData[key];
      for (const buffer in instanceData) {
        if (buffer === 'count') continue;
        if (buffer === 'lineSides') {
          for (let i = 0; i < instanceData.count; i++) {
            strokeData[buffer].push(...instanceData[buffer]);
          }
        } else if (
          key === 'segments' &&
          (buffer === 'lineVertexColors' || buffer === 'lineVertices')
        ) {
          const size = buffer === 'lineVertexColors' ? 4 : 3;
          for (let j = 0; j < instanceData[buffer].length; j += 2 * size) {
            for (let i = 0; i < instanceData.lineSides.length; i++) {
              for (const offset of [0, 1]) {
                for (let k = 0; k < size; k++) {
                  strokeData[buffer].push(instanceData[buffer][j + k + offset]);
                }
              }
            }
          }
        } else {
          const size = buffer === 'lineVertexColors' ? 4 : 3;
          for (let j = 0; j < instanceData[buffer].length; j++) {
            for (let i = 0; i < instanceData.lineSides.length; i++) {
              for (let k = 0; k < size; k++) {
                strokeData[buffer].push(instanceData[buffer][j + k]);
              }
              if (buffer === 'lineVertexColors' || buffer === 'lineVertices') {
                for (let k = 0; k < size; k++) {
                  strokeData[buffer].push(instanceData[buffer][j + k]);
                }
              }
            }
          }
        }
      }
    }
    this.webgl1StrokeDataDirty = false;
  }

  /**
 * computes faces for geometry objects based on the vertices.
 * @method computeFaces
 * @chainable
 */
  computeFaces() {
    this.faces.length = 0;
    const sliceCount = this.detailX + 1;
    let a, b, c, d;
    for (let i = 0; i < this.detailY; i++) {
      for (let j = 0; j < this.detailX; j++) {
        a = i * sliceCount + j; // + offset;
        b = i * sliceCount + j + 1; // + offset;
        c = (i + 1) * sliceCount + j + 1; // + offset;
        d = (i + 1) * sliceCount + j; // + offset;
        this.faces.push([a, b, d]);
        this.faces.push([d, b, c]);
      }
    }
    return this;
  }

  _getFaceNormal(faceId) {
  //This assumes that vA->vB->vC is a counter-clockwise ordering
    const face = this.faces[faceId];
    const vA = this.vertices[face[0]];
    const vB = this.vertices[face[1]];
    const vC = this.vertices[face[2]];
    const ab = p5.Vector.sub(vB, vA);
    const ac = p5.Vector.sub(vC, vA);
    const n = p5.Vector.cross(ab, ac);
    const ln = p5.Vector.mag(n);
    let sinAlpha = ln / (p5.Vector.mag(ab) * p5.Vector.mag(ac));
    if (sinAlpha === 0 || isNaN(sinAlpha)) {
      console.warn(
        'p5.Geometry.prototype._getFaceNormal:',
        'face has colinear sides or a repeated vertex'
      );
      return n;
    }
    if (sinAlpha > 1) sinAlpha = 1; // handle float rounding error
    return n.mult(Math.asin(sinAlpha) / ln);
  }
  /**
 * computes smooth normals per vertex as an average of each
 * face.
 * @method computeNormals
 * @chainable
 */
  computeNormals() {
    const vertexNormals = this.vertexNormals;
    const vertices = this.vertices;
    const faces = this.faces;
    let iv;

    // initialize the vertexNormals array with empty vectors
    vertexNormals.length = 0;
    for (iv = 0; iv < vertices.length; ++iv) {
      vertexNormals.push(new p5.Vector());
    }

    // loop through all the faces adding its normal to the normal
    // of each of its vertices
    for (let f = 0; f < faces.length; ++f) {
      const face = faces[f];
      const faceNormal = this._getFaceNormal(f);

      // all three vertices get the normal added
      for (let fv = 0; fv < 3; ++fv) {
        const vertexIndex = face[fv];
        vertexNormals[vertexIndex].add(faceNormal);
      }
    }

    // normalize the normals
    for (iv = 0; iv < vertices.length; ++iv) {
      vertexNormals[iv].normalize();
    }

    return this;
  }

  /**
 * Averages the vertex normals. Used in curved
 * surfaces
 * @method averageNormals
 * @chainable
 */
  averageNormals() {
    for (let i = 0; i <= this.detailY; i++) {
      const offset = this.detailX + 1;
      let temp = p5.Vector.add(
        this.vertexNormals[i * offset],
        this.vertexNormals[i * offset + this.detailX]
      );

      temp = p5.Vector.div(temp, 2);
      this.vertexNormals[i * offset] = temp;
      this.vertexNormals[i * offset + this.detailX] = temp;
    }
    return this;
  }

  /**
 * Averages pole normals.  Used in spherical primitives
 * @method averagePoleNormals
 * @chainable
 */
  averagePoleNormals() {
  //average the north pole
    let sum = new p5.Vector(0, 0, 0);
    for (let i = 0; i < this.detailX; i++) {
      sum.add(this.vertexNormals[i]);
    }
    sum = p5.Vector.div(sum, this.detailX);

    for (let i = 0; i < this.detailX; i++) {
      this.vertexNormals[i] = sum;
    }

    //average the south pole
    sum = new p5.Vector(0, 0, 0);
    for (
      let i = this.vertices.length - 1;
      i > this.vertices.length - 1 - this.detailX;
      i--
    ) {
      sum.add(this.vertexNormals[i]);
    }
    sum = p5.Vector.div(sum, this.detailX);

    for (
      let i = this.vertices.length - 1;
      i > this.vertices.length - 1 - this.detailX;
      i--
    ) {
      this.vertexNormals[i] = sum;
    }
    return this;
  }

  /**
 * Create a 2D array for establishing stroke connections
 * @private
 * @chainable
 */
  _makeTriangleEdges() {
    this.edges.length = 0;

    for (let j = 0; j < this.faces.length; j++) {
      this.edges.push([this.faces[j][0], this.faces[j][1]]);
      this.edges.push([this.faces[j][1], this.faces[j][2]]);
      this.edges.push([this.faces[j][2], this.faces[j][0]]);
    }

    return this;
  }

  /**
 * Converts each line segment into the vertices and vertex attributes needed
 * to turn the line into a polygon on screen. This will include:
 * - Two triangles line segment to create a rectangle
 * - Two triangles per endpoint to create a stroke cap rectangle. A fragment
 *   shader is responsible for displaying the appropriate cap style within
 *   that rectangle.
 * - Four triangles per join between adjacent line segments, creating a quad on
 *   either side of the join, perpendicular to the lines. A vertex shader will
 *   discard the quad in the "elbow" of the join, and a fragment shader will
 *   display the appropriate join style within the remaining quad.
 *
 * @private
 * @chainable
 */
  _edgesToVertices() {
    for (const key in this.lineData) {
      this.lineData[key].count = 0;
      this.lineData[key].lineVertices.length = 0;
      this.lineData[key].lineTangentsIn.length = 0;
      this.lineData[key].lineTangentsOut.length = 0;
      this.lineData[key].lineVertexColors.length = 0;
    }

    const closed =
    this.edges.length > 1 &&
    this.edges[0][0] === this.edges[this.edges.length - 1][1];
    let addedStartingCap = false;
    let lastValidDir;
    for (let i = 0; i < this.edges.length; i++) {
      const prevEdge = this.edges[i - 1];
      const currEdge = this.edges[i];
      const begin = this.vertices[currEdge[0]];
      const end = this.vertices[currEdge[1]];
      const fromColor = this.vertexStrokeColors.length > 0
        ? this.vertexStrokeColors.slice(
          currEdge[0] * 4,
          (currEdge[0] + 1) * 4
        )
        : [0, 0, 0, 0];
      const toColor = this.vertexStrokeColors.length > 0
        ? this.vertexStrokeColors.slice(
          currEdge[1] * 4,
          (currEdge[1] + 1) * 4
        )
        : [0, 0, 0, 0];
      const dir = end
        .copy()
        .sub(begin)
        .normalize();
      const dirOK = dir.magSq() > 0;
      if (dirOK) {
        this._addSegment(begin, end, fromColor, toColor, dir);
      }

      if (i > 0 && prevEdge[1] === currEdge[0]) {
      // Add a join if this segment shares a vertex with the previous. Skip
      // actually adding join vertices if either the previous segment or this
      // one has a length of 0.
      //
      // Don't add a join if the tangents point in the same direction, which
      // would mean the edges line up exactly, and there is no need for a join.
        if (lastValidDir && dirOK && dir.dot(lastValidDir) < 1 - 1e-8) {
          this._addJoin(begin, lastValidDir, dir, fromColor);
        }
        if (dirOK && !addedStartingCap && !closed) {
          this._addCap(begin, dir.copy().mult(-1), fromColor);
          addedStartingCap = true;
        }
      } else {
        addedStartingCap = false;
        // Start a new line
        if (dirOK && (!closed || i > 0)) {
          this._addCap(begin, dir.copy().mult(-1), fromColor);
          addedStartingCap = true;
        }
        if (lastValidDir && (!closed || i < this.edges.length - 1)) {
        // Close off the last segment with a cap
          this._addCap(this.vertices[prevEdge[1]], lastValidDir, fromColor);
          lastValidDir = undefined;
        }
      }

      if (i === this.edges.length - 1) {
        if (closed) {
          this._addJoin(
            end,
            dir,
            this.vertices[this.edges[0][1]]
              .copy()
              .sub(end)
              .normalize(),
            toColor
          );
        } else {
          this._addCap(end, dir, toColor);
        }
      }

      if (dirOK) {
        lastValidDir = dir;
      }
    }
    return this;
  }

  /**
 * Adds the vertices and vertex attributes for two triangles making a rectangle
 * for a straight line segment. A vertex shader is responsible for picking
 * proper coordinates on the screen given the centerline positions, the tangent,
 * and the side of the centerline each vertex belongs to. Sides follow the
 * following scheme:
 *
 *  -1            -3
 *   o-------------o
 *   |             |
 *   o-------------o
 *   1             3
 *
 * @private
 * @chainable
 */
  _addSegment(
    begin,
    end,
    fromColor,
    toColor,
    dir
  ) {
    const a = begin.array();
    const b = end.array();
    const dirArr = dir.array();
    this.lineData.segments.lineTangentsIn.push(...dirArr);
    this.lineData.segments.lineTangentsOut.push(...dirArr);
    this.lineData.segments.lineVertices.push(...a, ...b);
    this.lineData.segments.lineVertexColors.push(
      ...fromColor,
      ...toColor
    );
    this.lineData.segments.count++;
    return this;
  }

  /**
 * Adds the vertices and vertex attributes for two triangles representing the
 * stroke cap of a line. A fragment shader is responsible for displaying the
 * appropriate cap style within the rectangle they make.
 *
 * The lineSides buffer will include the following values for the points on
 * the cap rectangle:
 *
 *           -1  -2
 * -----------o---o
 *            |   |
 * -----------o---o
 *            1   2
 * @private
 * @chainable
 */
  _addCap(point, tangent, color) {
    const ptArray = point.array();
    const tanInArray = tangent.array();
    const tanOutArray = [0, 0, 0];
    this.lineData.caps.lineVertices.push(...ptArray);
    this.lineData.caps.lineTangentsIn.push(...tanInArray);
    this.lineData.caps.lineTangentsOut.push(...tanOutArray);
    this.lineData.caps.lineVertexColors.push(...color);
    this.lineData.caps.count++;
    return this;
  }

  /**
 * Adds the vertices and vertex attributes for four triangles representing a
 * join between two adjacent line segments. This creates a quad on either side
 * of the shared vertex of the two line segments, with each quad perpendicular
 * to the lines. A vertex shader will discard all but the quad in the "elbow" of
 * the join, and a fragment shader will display the appropriate join style
 * within the remaining quad.
 *
 * The lineSides buffer will include the following values for the points on
 * the join rectangles:
 *
 *            -1     -2
 * -------------o----o
 *              |    |
 *       1 o----o----o -3
 *         |    | 0  |
 * --------o----o    |
 *        2|    3    |
 *         |         |
 *         |         |
 * @private
 * @chainable
 */
  _addJoin(
    point,
    fromTangent,
    toTangent,
    color
  ) {
    const ptArray = point.array();
    const tanInArray = fromTangent.array();
    const tanOutArray = toTangent.array();
    this.lineData.joins.lineVertices.push(...ptArray);
    this.lineData.joins.lineTangentsIn.push(...tanInArray);
    this.lineData.joins.lineTangentsOut.push(...tanOutArray);
    this.lineData.joins.lineVertexColors.push(...color);
    this.lineData.joins.count++;
    return this;
  }

  /**
 * Modifies all vertices to be centered within the range -100 to 100.
 * @method normalize
 * @chainable
 */
  normalize() {
    if (this.vertices.length > 0) {
    // Find the corners of our bounding box
      const maxPosition = this.vertices[0].copy();
      const minPosition = this.vertices[0].copy();

      for (let i = 0; i < this.vertices.length; i++) {
        maxPosition.x = Math.max(maxPosition.x, this.vertices[i].x);
        minPosition.x = Math.min(minPosition.x, this.vertices[i].x);
        maxPosition.y = Math.max(maxPosition.y, this.vertices[i].y);
        minPosition.y = Math.min(minPosition.y, this.vertices[i].y);
        maxPosition.z = Math.max(maxPosition.z, this.vertices[i].z);
        minPosition.z = Math.min(minPosition.z, this.vertices[i].z);
      }

      const center = p5.Vector.lerp(maxPosition, minPosition, 0.5);
      const dist = p5.Vector.sub(maxPosition, minPosition);
      const longestDist = Math.max(Math.max(dist.x, dist.y), dist.z);
      const scale = 200 / longestDist;

      for (let i = 0; i < this.vertices.length; i++) {
        this.vertices[i].sub(center);
        this.vertices[i].mult(scale);
      }
    }
    return this;
  }
};
export default p5.Geometry;
