/* global webDB, define */
'use strict';

define(['webdb'], function (webDB) {

    describe("Indexeddb test", function () {
    
        var indexedDBSupported = !!(window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB || window.msIndexedDB || window.oIndexedDB),
            webSQLSupported = !!window.openDatabase,
            config = {
                id: "webdb-test",
                schema: {
                    test: {
                        key: {
                            keyPath: 'id',
                            autoIncrement: false
                        },
                        fields: {
                            id: {
                                type: 'TEXT',
                                notNull: true
                            },
                            name: {
                                type: 'TEXT'
                            },
                            age: {
                                type: 'INTEGER'
                            }
                        }
                    }
                }
            };
    
        describe("open", function () {
    
            if (indexedDBSupported) {
    
                it("open indexeddb", function () {
                    var _config = config,
                        done = false,
                        DB;
    
                    _config.type = webDB.TYPE_INDEXEDDB;
                    DB = webDB(_config);
    
                    runs(function () {
                        DB.open().done(function () {
                            done = true;
                        });
                    });
    
                    waitsFor(function () {
                        return done;
                    }, 'timeout for open indexedDB', 1000);
    
                    runs(function () {
                        expect(DB.DB).toBeDefined();
                    });
                });
            }
    
            if (webSQLSupported) {}
        });
    });
});
