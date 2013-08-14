/* global define*/

var __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['dbjs/defer', 'dbjs/db'], factory);
  } else {
    root.kvDB = factory(root.Deferred, root.db);
  }
})(window, function(deferred, DBjs) {
  "use strict";
  var DBBase, Factory, GUID, IndexedDB, S4, TYPE_INDEXEDDB, TYPE_WEBSQL, WebSQL, defaultConfig, extend, fun, slice, _ref, _ref1;
  TYPE_INDEXEDDB = 'indexeddb';
  TYPE_WEBSQL = 'websql';
  S4 = function() {
    return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  };
  GUID = function() {
    return "" + (S4()) + (S4()) + "-" + (S4()) + "-" + (S4()) + "-" + (S4()) + "-" + (S4()) + (S4()) + (S4());
  };
  extend = function(obj) {
    var arg, obj2, _fn, _i, _len, _ref;
    obj2 = obj;
    _ref = slice.call(arguments, 1);
    _fn = function(arg) {
      var k, v;
      for (k in arg) {
        v = arg[k];
        if (arg.hasOwnProperty(k)) {
          obj2[k] = v;
        }
      }
    };
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      arg = _ref[_i];
      _fn(arg);
    }
    return obj2;
  };
  slice = Array.prototype.slice;
  defaultConfig = {
    id: GUID(),
    version: '1',
    description: null,
    schema: null,
    size: 5 * 1024 * 1024,
    type: (function() {
      var type;
      type = window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB;
      if (!!type) {
        return TYPE_INDEXEDDB;
      }
      type = window.openDatabase;
      if (!!type) {
        return TYPE_WEBSQL;
      }
      throw 'Need IndexedDB or WebSQL supported in your browser.';
    })()
  };
  DBBase = (function() {
    function DBBase(config) {
      this.config = config;
    }

    return DBBase;

  })();
  IndexedDB = (function(_super) {
    __extends(IndexedDB, _super);

    function IndexedDB() {
      _ref = IndexedDB.__super__.constructor.apply(this, arguments);
      return _ref;
    }

    IndexedDB.prototype.open = function() {
      var config, dtd, schema, storeName,
        _this = this;
      config = this.config;
      config.server = config.id;
      schema = config.schema;
      storeName = Object.keys(schema)[0];
      dtd = deferred();
      DBjs.open(config).done(function(s) {
        _this.config._db = s[storeName];
        dtd.resolve();
      }).fail(function() {
        dtd.reject();
      });
      return dtd;
    };

    IndexedDB.prototype.close = function() {
      var config;
      config = this.config;
      return config._db.close();
    };

    IndexedDB.prototype.create = function(data) {
      var config;
      config = this.config;
      return config._db.add(data);
    };

    IndexedDB.prototype.get = function(id) {
      var config;
      config = this.config;
      return config._db.get(id);
    };

    IndexedDB.prototype.all = function() {
      var config;
      config = this.config;
      return config._db.query().all().execute();
    };

    IndexedDB.prototype.remove = function(id) {
      var config;
      config = this.config;
      return config._db.remove(id);
    };

    IndexedDB.prototype.clear = function() {
      var config;
      config = this.config;
      return config._db.clear();
    };

    IndexedDB.prototype.drop = function() {
      var config;
      config = this.config;
      return config._db.drop();
    };

    return IndexedDB;

  })(DBBase);
  WebSQL = (function(_super) {
    __extends(WebSQL, _super);

    function WebSQL() {
      _ref1 = WebSQL.__super__.constructor.apply(this, arguments);
      return _ref1;
    }

    WebSQL.prototype._generateFieldsStatement = function(fields, key) {
      /*
      # Table fields example:
      #   fields: {
      #       field_name: {
      #           type: "TEXT",
      #           unique: true,
      #           default: "option default",
      #           notNull: true,
      #           autoIncrement: false
      #       }
      #   }
      */

      var f, field, fieldList, gen, primaryKey, primaryKeyOptions, _i, _len, _ref2;
      fieldList = [];
      gen = function(name, type, options, primary) {
        var result;
        if (primary == null) {
          primary = false;
        }
        result = [name];
        result.push(type);
        if (primary) {
          result.push("PRIMARY KEY");
        }
        if (options.notNull) {
          result.push("NOT NULL");
        }
        if (!!options["default"]) {
          result.push("DEFAULT");
          result.push(options["default"]);
        }
        if (options.autoIncrement) {
          result.push("AUTOINCREMENT");
        }
        return result.join(" ");
      };
      primaryKey = fields[key.keyPath];
      primaryKeyOptions = {
        autoIncrement: key.autoIncrement,
        notNull: true
      };
      fieldList.push(gen(key.keyPath, primaryKey.type, primaryKeyOptions, true));
      _ref2 = Object.keys(fields);
      for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
        f = _ref2[_i];
        field = fields[f];
        fieldList.push(gen(f, field.type, field, false));
      }
      return fieldList.join(", ");
    };

    WebSQL.prototype._qmarks = function(count) {
      var array, c;
      c = count;
      array = [];
      while (c > 0) {
        array.push("?");
        c--;
      }
      return array.join(",");
    };

    WebSQL.prototype.open = function() {
      var config, db, dbName, description, dtd, fields, key, schema, size, storeName, that, version;
      that = this;
      config = this.config;
      schema = config.schema;
      dbName = config.id;
      description = config.description || dbName;
      storeName = Object.keys(schema)[0];
      fields = schema[storeName].fields;
      key = schema[storeName].key;
      version = config.version;
      size = config.size;
      dtd = deferred();
      if (!fields) {
        throw "No fields defined in config object";
      }
      db = openDatabase(dbName, version, description, size);
      db.transaction(function(transaction) {
        /*
        # Table fields example:
        #   fields: {
        #       field_name: {
        #           type: "TEXT",
        #           unique: true,
        #           default: "option default",
        #           notNull: true,
        #           autoIncrement: false
        #       }
        #   }
        */

        return transaction.executeSql("CREATE TABLE IF NOT EXISTS " + storeName + " (" + (that._generateFieldsStatement(fields, key)) + ");", null, function() {
          that.config._db = db;
          dtd.resolve();
        }, function() {
          return console.log("SQL statement error ", arguments[1]);
        });
      });
      return dtd;
    };

    WebSQL.prototype.close = function() {};

    WebSQL.prototype.create = function(data) {
      var config, dtd, f, fields, i, qmarks, record, schema, storeName, that, values, _i, _j, _len, _ref2;
      that = this;
      config = this.config;
      schema = config.schema;
      storeName = Object.keys(schema)[0];
      record = data;
      dtd = deferred();
      if (!record) {
        dtd.reject();
        return dtd;
      }
      fields = Object.keys(record);
      qmarks = [];
      for (i = _i = 0, _ref2 = fields.length; 0 <= _ref2 ? _i < _ref2 : _i > _ref2; i = 0 <= _ref2 ? ++_i : --_i) {
        qmarks.push("?");
      }
      values = [];
      for (_j = 0, _len = fields.length; _j < _len; _j++) {
        f = fields[_j];
        values.push(record[f]);
      }
      config._db.transaction(function(transaction) {
        var errorCallback, successCallback;
        successCallback = function() {
          return dtd.resolve(record);
        };
        errorCallback = function() {
          var error;
          error = arguments[1];
          if (error.code === error.CONSTRAINT_ERR) {
            return that.get(record.id).done(function(result) {
              dtd.resolve(result);
            }).fail(function() {
              dtd.reject();
            });
          } else {
            return dtd.reject();
          }
        };
        return transaction.executeSql("INSERT INTO " + storeName + " (" + (fields.join(',')) + ") VALUES (" + qmarks + ");", values, successCallback, errorCallback);
      });
      return dtd;
    };

    WebSQL.prototype.get = function(id) {
      var config, dtd, keyPath, schema, storeName;
      config = this.config;
      schema = config.schema;
      storeName = Object.keys(schema)[0];
      keyPath = schema[storeName].key.keyPath;
      dtd = deferred();
      if (!id) {
        dtd.reject();
        return dtd;
      }
      config._db.transaction(function(transaction) {
        var errorCallback, successCallback;
        successCallback = function() {
          var item, resultSet;
          resultSet = arguments[1];
          item = resultSet.rows.item(0);
          dtd.resolve(item);
        };
        errorCallback = function() {
          console.log(arguments[1]);
          return dtd.reject();
        };
        return transaction.executeSql("SELECT * FROM " + storeName + " WHERE " + keyPath + "=?;", [id], successCallback, errorCallback);
      });
      return dtd;
    };

    WebSQL.prototype.all = function() {
      var config, dtd, schema, storeName, that;
      that = this;
      config = this.config;
      schema = config.schema;
      storeName = Object.keys(schema)[0];
      dtd = deferred();
      config._db.transaction(function(transaction) {
        var errorCallback, successCallback;
        successCallback = function() {
          var i, item, result, resultSet, rows;
          resultSet = arguments[1];
          rows = resultSet.rows;
          result = [];
          i = 0;
          while (true) {
            item = rows.item(i);
            if (!item) {
              break;
            } else {
              result.push(item);
              i++;
            }
          }
          dtd.resolve(result);
        };
        errorCallback = function() {
          console.log("Select SQL statement error ", arguments[1]);
          dtd.reject();
        };
        return transaction.executeSql("SELECT * FROM " + storeName + ";", null, successCallback, errorCallback);
      });
      return dtd;
    };

    WebSQL.prototype.remove = function(id) {
      var config, dtd, keyPath, schema, storeName;
      config = this.config;
      schema = config.schema;
      storeName = Object.keys(schema)[0];
      keyPath = schema[storeName].key.keyPath;
      dtd = deferred();
      if (!id) {
        dtd.reject();
        return dtd;
      }
      config._db.transaction(function(transaction) {
        return transaction.executeSql("DELETE FROM " + storeName + " WHERE " + keyPath + "=?;", [id], function() {
          return dtd.resolve(id);
        }, function() {
          console.log("Delete SQL statement error", arguments[1]);
          return dtd.reject();
        });
      });
      return dtd;
    };

    WebSQL.prototype.clear = function() {
      var config, dtd, schema, storeName;
      config = this.config;
      schema = this.config.schema;
      storeName = Object.keys(schema)[0];
      dtd = deferred();
      config._db.transaction(function(transaction) {
        return transaction.executeSql("DELETE FROM " + storeName, null, function() {
          return dtd.resolve();
        }, function() {
          console.log("Clear SQL statement error", arguments[1]);
          return dtd.reject();
        });
      });
      return dtd;
    };

    WebSQL.prototype.drop = function() {
      throw "Not support delete database, see the spec 4.1 Databases";
    };

    return WebSQL;

  })(DBBase);
  Factory = (function() {
    Factory.prototype.ACTIONS = ['open', 'create', 'get', 'all', 'remove', 'clear', 'drop', 'close'];

    function Factory(config) {
      var _config;
      _config = {};
      _config = extend(defaultConfig, config);
      this.config = _config;
    }

    Factory.prototype._open = function() {
      var d, dtd;
      dtd = deferred();
      if (!!this._DB) {
        dtd.resolve();
        return dtd;
      }
      switch (this.config.type) {
        case TYPE_INDEXEDDB:
          this._DB = new IndexedDB(this.config);
          break;
        case TYPE_WEBSQL:
          this._DB = new WebSQL(this.config);
          break;
        default:
          throw 'Type error';
      }
      d = this._DB.open();
      d.done(function() {
        dtd.resolve();
      });
      d.fail(function() {
        dtd.reject();
      });
      return dtd;
    };

    Factory.prototype["do"] = function(actionName) {
      if (typeof actionName !== 'string') {
        throw "Not string.";
      }
      if (this.ACTIONS.indexOf(actionName) === -1) {
        throw "No command named \"" + actionName + "\"";
      }
      if (actionName === this.ACTIONS[0]) {
        return this._open();
      }
      return this._DB[actionName].apply(this._DB, slice.call(arguments, 1));
    };

    return Factory;

  })();
  fun = function(config) {
    if (config == null) {
      config = defaultConfig;
    }
    return new Factory(config);
  };
  fun.TYPE_INDEXEDDB = TYPE_INDEXEDDB;
  fun.TYPE_WEBSQL = TYPE_WEBSQL;
  return fun;
});
