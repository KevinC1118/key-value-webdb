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
  var DBBase, Factory, GUID, IndexedDB, S4, TYPE_INDEXEDDB, TYPE_WEBSQL, WebSQL, defaultConfig, extend, slice, _ref, _ref1;
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
      var config, dtd, schema,
        _this = this;
      config = this.config;
      config.server = config.id;
      schema = config.schema;
      dtd = deferred();
      this.storeName = Object.keys(schema)[0];
      DBjs.open(config).done(function(s) {
        _this._db = s;
        dtd.resolve();
      }).fail(function() {
        dtd.reject();
      });
      return dtd;
    };

    IndexedDB.prototype.close = function() {
      return this._db.close();
    };

    IndexedDB.prototype.create = function() {
      var that;
      that = this._db[this.storeName];
      return that.add.apply(that, arguments);
    };

    IndexedDB.prototype.get = function(id) {
      return this._db[this.storeName].get(id);
    };

    IndexedDB.prototype.all = function() {
      return this._db[this.storeName].query().all().execute();
    };

    IndexedDB.prototype.remove = function(id) {
      return this._db[this.storeName].remove(id);
    };

    IndexedDB.prototype.clear = function() {
      return this._db[this.storeName].clear();
    };

    IndexedDB.prototype.drop = function() {
      return this._db.drop();
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
        if (!!options["default"]) {
          result.push("DEFAULT");
          result.push(options["default"]);
        }
        if (options.autoIncrement) {
          result.push("AUTOINCREMENT");
        } else {
          if (!!options["default"]) {
            result.push("DEFAULT");
            result.push("'" + options["default"] + "'");
          }
          if (options.notNull) {
            result.push("NOT NULL");
          }
        }
        return result.join(" ");
      };
      primaryKey = key.keyPath;
      primaryKeyOptions = {
        autoIncrement: !!key.autoIncrement,
        notNull: true
      };
      if (fields.hasOwnProperty(primaryKey)) {
        primaryKeyOptions = extend(fields[primaryKey], primaryKeyOptions);
      }
      if (primaryKeyOptions.autoIncrement) {
        primaryKeyOptions.type = 'INTEGER';
      } else {
        primaryKeyOptions.type = primaryKeyOptions.type ? primaryKeyOptions.type : 'TEXT';
      }
      fieldList.push(gen(primaryKey, primaryKeyOptions.type, primaryKeyOptions, true));
      _ref2 = Object.keys(fields);
      for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
        f = _ref2[_i];
        if (f === primaryKey) {
          continue;
        }
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

        var statement;
        statement = that._generateFieldsStatement(fields, key);
        return transaction.executeSql("CREATE TABLE IF NOT EXISTS " + storeName + " (" + statement + ");", null, function() {
          that._db = db;
          dtd.resolve();
        }, function() {
          console.log(statement);
          return console.log("SQL statement error ", arguments[1]);
        });
      });
      return dtd;
    };

    WebSQL.prototype.create = function() {
      var config, dtd, f, fields, i, qmarks, record, schema, storeName, that, values, _i, _j, _len, _ref2;
      that = this;
      config = this.config;
      schema = config.schema;
      storeName = Object.keys(schema)[0];
      record = arguments[0];
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
      this._db.transaction(function(transaction) {
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
      this._db.readTransaction(function(transaction) {
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
      this._db.readTransaction(function(transaction) {
        var errorCallback, successCallback;
        successCallback = function() {
          var e, i, item, result, resultSet, rows;
          resultSet = arguments[1];
          rows = resultSet.rows;
          result = [];
          i = 0;
          while (true) {
            try {
              item = rows.item(i);
            } catch (_error) {
              e = _error;
              item = null;
            }
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
      this._db.transaction(function(transaction) {
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
      this._db.transaction(function(transaction) {
        return transaction.executeSql("DELETE FROM " + storeName, null, function() {
          return dtd.resolve();
        }, function() {
          console.log("Clear SQL statement error", arguments[1]);
          return dtd.reject();
        });
      });
      return dtd;
    };

    return WebSQL;

  })(DBBase);
  Factory = (function() {
    Factory.prototype.ACTIONS = ['create', 'get', 'all', 'remove', 'clear', 'drop', 'close'];

    function Factory(config) {
      var _config;
      _config = {};
      _config = extend(defaultConfig, config);
      this.config = _config;
    }

    Factory.prototype.open = function() {
      var d, db, dtd,
        _this = this;
      dtd = deferred();
      switch (this.config.type) {
        case TYPE_INDEXEDDB:
          db = new IndexedDB(this.config);
          break;
        case TYPE_WEBSQL:
          db = new WebSQL(this.config);
          break;
        default:
          throw 'Database type error';
      }
      d = db.open();
      d.done(function() {
        var instance, k, wrapper, _i, _len, _ref2;
        instance = {};
        wrapper = function(db, method) {
          return db[method].apply(db, slice.call(arguments, 2));
        };
        _ref2 = Object.keys(Object.getPrototypeOf(db));
        for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
          k = _ref2[_i];
          if (_this.ACTIONS.indexOf(k) !== -1) {
            instance[k] = wrapper.bind(instance, db, k);
          }
        }
        dtd.resolve(instance);
      });
      d.fail(function() {
        dtd.reject();
      });
      return dtd;
    };

    return Factory;

  })();
  Factory.TYPE_INDEXEDDB = TYPE_INDEXEDDB;
  Factory.TYPE_WEBSQL = TYPE_WEBSQL;
  return Factory;
});
