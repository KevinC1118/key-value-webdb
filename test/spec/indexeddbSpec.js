describe("Indexeddb test", function () {

    var config = {
        id: "webdb-test",
        schema: {
            test: {
                key: {
                    keyPath: 'id'
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
        var server,
            indexedDB = window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB;

        afterEach(function () {
            var done = false;
            runs(function () {
                var rep = indexedDB.deleteDatabase(config.id);
                req.onsuccess = function () {};
            });
        });
    });
});
