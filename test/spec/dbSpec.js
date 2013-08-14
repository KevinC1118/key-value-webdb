/* global webDB, define */
'use strict';

define(['webdb'], function (webDB) {
    var indexedDB = window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB || window.msIndexedDB || window.oIndexedDB;

    describe("Indexeddb test", function () {

        var DB, config = {
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

        afterEach(function () {
            var done = false;
            
            runs(function () {
                var req = indexedDB.deleteDatabase(config.id);
                req.onsuccess = function () {
                    done = true;
                };
            });

            waitsFor(function () {
                return done;
            }, 'timeout for delete database', 1000);
        });

        it("open", function () {
            var _config = config,
                done = false;
    
            _config.type = webDB.TYPE_INDEXEDDB;
            DB = webDB(_config);
    
            runs(function () {
                DB.do('open').done(function () {
                    done = true;
                });
            });
    
            waitsFor(function () {
                return done;
            }, 'timeout for open indexedDB', 1000);
    
            runs(function () {
                expect(DB._DB).toBeDefined();
                DB.do('close');
            });
        });
    });
});
