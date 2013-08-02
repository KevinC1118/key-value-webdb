### globalstrict ###
### globals: define ###
"use strict"
((root, factory) ->

    if typeof define is 'function' and define.amd
        define ['modernizr'], factory
    else
        root.webDB = factory(Modernizr)

)(@, (Modernizr) ->
    # example:
    # It mush include id property in a plain object record, for example: {id: 1, name: "John", age: 18}.
    # There are only two properties for blob object record. For example:
    # {id: 1, blob: blob object}

    _CACHE = {}

    globalDBConfig =
        type: null
        version: 1

    localDBConfig =
        userId: ''
        storeName: 'webapp'
        blob: false

    if Modernizr.indexeddb
        globalDBConfig.type = 'indexeddb'
    else if Modernizr.websqldatabase
        globalDBConfig.type = 'websql'

    if globalDBConfig.type is null then return

    open =
        websql: (config) ->
            dbName = config.dbName
            storeName = config.storeName
            maxsize = 1024 * 1024 * 50  # 50MB
            dtd = $.Deferred()

            try
                db = openDatabase(dbName, "", dbName, maxsize)
            catch e
                if e.name is "SECURITY_ERR"
                    db = openDatabase(dbName, "", dbName, 1024 * 1024 * 20)
                else
                    throw e
            finally
                # On android 2.x, openDatabase return null instead of throw quote exceed exception.
                if db is null
                    db = openDatabase(dbName, '', dbName, 1024 * 1024 * 5)

                if db is null
                    console.log('db is null')
                    setTimeout(
                        -> dtd.reject()
                        0
                    )
                    return dtd

            db.transaction (transaction) ->
                transaction.executeSql(
                    "CREATE TABLE IF NOT EXISTS #{storeName} (id TEXT PRIMARY KEY, data);"
                    []
                    ->
                        dtd.resolve(db)
                    (_t, e) ->
                        console.log(e.stack)
                )
                
            return dtd

        indexeddb: (config) ->
            mee = @
            dtd = $.Deferred()
            userId = config.userId
            storeName = config.storeName
            dbName = config.dbName

            indexedDB = window.indexedDB \
                or window.webkitIndexedDB \
                or window.mozIndexedDB \
                or window.msIndexedDB

            window.IDBTransaction = window.IDBTransaction or window.webkitIDBTransaction

            # Add username as prefix
            req = indexedDB.open("WEBAPP-#{dbName}", globalDBConfig.version)

            req.onsuccess = (evt) ->
                db = evt.target.result

                if not db.objectStoreNames.contains(storeName)
                    verReq = db.setVersion(globalDBConfig.version)

                    verReq.onsuccess = (_evt) ->
                        db.createObjectStore(storeName)
                        dtd.resolve(db)

                    verReq.onerror = (_evt) ->
                        console.log(_evt)

                else
                    dtd.resolve(db)

            req.onerror = (evt) ->
                console.log evt.target
                dtd.reject()

            req.onupgradeneeded = (evt) ->
                db = evt.target.result
                try
                    db.deleteObjectStore(storeName)
                catch error
                    console.log(error)

                try
                    db.createObjectStore(storeName)
                catch error
                    console.log(error)

            return dtd

    create =
        websql: (record) ->
            mee = @
            config = @config
            db = config.db
            dbName = config.dbName
            storeName = config.storeName
            dtd = $.Deferred()

            if not record
                setTimeout(
                    -> dtd.reject()
                    0
                )
                return dtd

            mee.read(record.id)
            .done (record) ->
                dtd.resolve(record)

            .fail (status) ->
                if status?.NO_DATA
                    db.transaction (transaction) ->
                        
                        data = if config.blob then record.blob else JSON.stringify(record)

                        transaction.executeSql(
                            "INSERT INTO #{storeName} (id, data) VALUES (?, ?);"
                            [record.id, data]
                            (_t, resultSet) ->
                                rowsAffected = resultSet.rowsAffected
                                if rowsAffected is 1
                                    _CACHE[dbName][record.id] = record
                                    dtd.resolve(record)
                                else
                                    console.log("Record #{record.id} not insert correctly.")
                                    dtd.reject()

                            (_t, e) ->
                                console.log(e.stack)
                                dtd.reject()
                        )
                else
                    dtd.reject()

            return dtd

        indexeddb: (record) ->
            mee = @
            config = @config
            db = config.db
            storeName = config.storeName
            dbName = config.dbName

            dtd = $.Deferred()
            if not record
                setTimeout(
                    -> dtd.reject()
                    0
                )
                return dtd

            mee.read(record.id)
            .done (rd) ->
                dtd.resolve(rd)

            .fail (status) ->
                if status?.NO_DATA
                    objStor = db.transaction(storeName, IDBTransaction.READ_WRITE or 'readwrite').objectStore(storeName)
                    data = if config.blob then record.blob else record
                    addReq = objStor.add(data, record.id)
                    addReq.onsuccess = (evt) ->
                        _CACHE[dbName][record.id] = record
                        dtd.resolve(record)
                    addReq.onerror = (evt) ->
                        console.log(evt)
                        dtd.reject()
                else
                    dtd.reject()

            return dtd
        
    read =
        websql: (id) ->
            mee = @
            config = @config
            db = config.db
            dbName = config.dbName
            storeName = config.storeName
            dtd = $.Deferred()

            if not id
                setTimeout(
                    -> dtd.reject()
                    0
                )
                return dtd

            record = _CACHE[dbName][id]
            if record
                setTimeout(
                    -> dtd.resolve(record)
                    0
                )
                return dtd

            db.transaction (transaction) ->
                transaction.executeSql(
                    "SELECT * FROM #{storeName} WHERE id=?;"
                    [id]
                    (_t, rs) ->
                        rows = rs.rows
                        if rows.length is 0
                            dtd.reject({'NO_DATA': true})
                        else
                            record = rows.item(0)
                            record = mee._convertToObject(record.data, record.id)
                            _CACHE[dbName][record.id] = record
                            dtd.resolve(record)
                    (_t, e) ->
                        console.log(e.stack)
                        dtd.reject()
                )

            return dtd

        indexeddb: (id) ->
            mee = @
            config = @config
            db = config.db
            storeName = config.storeName
            dbName = config.dbName

            dtd = $.Deferred()

            if not id
                setTimeout(
                    -> dtd.reject()
                    0
                )
                return dtd

            record = _CACHE[dbName][id]
            if record
                setTimeout(
                    -> dtd.resolve record
                    0
                )
                return dtd

            objStor = db.transaction(storeName, IDBTransaction.READ_ONLY or 'readonly').objectStore(storeName)
            getReq = objStor.get(id)
            getReq.onsuccess = (evt) ->
                rd = evt.target.result
                if rd
                    rd = mee._convertToObject(rd, id)
                    _CACHE[dbName][id] = rd
                    dtd.resolve(rd)
                else
                    dtd.reject({'NO_DATA': true})
            getReq.onerror = (evt) ->
                console.log(evt)
                dtd.reject()

            return dtd

    readAll =
        websql: ->
            mee = @
            config = @config
            db = config.db
            dbName = config.dbName
            storeName = config.storeName
            dtd = $.Deferred()

            result = new Array()

            db.transaction (transaction) ->
                transaction.executeSql(
                    "SELECT * FROM #{storeName};"
                    []
                    (_t, resultSet) ->
                        rows = resultSet.rows
                        for i in [0...rows.length]
                            record = rows.item(i)
                            record = mee._convertToObject(record.data, record.id)
                            _CACHE[dbName][record.id] = record
                            result.push(record)
                        
                        dtd.resolve(result)
                    (_t, e) ->
                        console.log(e.stack)
                        dtd.reject()
                )

            return dtd

        indexeddb: ->
            mee = @
            config = @config
            db = config.db
            storeName = config.storeName
            dbName = config.dbName

            dtd = $.Deferred()
            result = new Array()

            objStor = db.transaction(storeName, IDBTransaction.READ_ONLY or 'readonly').objectStore(storeName)
            cursorReq = objStor.openCursor()
            cursorReq.onsuccess = (event) ->
                cursor = event.target.result
                if cursor
                    record = cursor.value
                    record = mee._convertToObject(record, record.id)
                    result.push(record)
                    _CACHE[dbName][record.id] = record
                    cursor.continue()
                else
                    dtd.resolve(result)

            cursorReq.onerror = (evt) ->
                console.log(evt)
                dtd.reject()

            return dtd

    update =
        websql: (record) ->
            mee = @
            config = @config
            db = config.db
            dbName = config.dbName
            storeName = config.storeName
            dtd = $.Deferred()

            if not record
                setTimeout(
                    -> dtd.reject()
                    0
                )
                return dtd

            db.transaction (transaction) ->
                data = if config.blob then record.blob else JSON.stringify(record)
                transaction.executeSql(
                    "UPDATE #{storeName} SET data=? WHERE id=?;"
                    [data, record.id]
                    (_t, resultSet) ->
                        _CACHE[dbName][record.id] = record
                        dtd.resolve(record)
                    (_t, e) ->
                        console.log(e.stack)
                        dtd.reject()
                )

            return dtd

        indexeddb: (record) ->
            mee = @
            config = @config
            db = config.db
            storeName = config.storeName
            dbName = config.dbName

            dtd = $.Deferred()

            if not record
                setTimeout(
                    -> dtd.reject()
                    0
                )
                return dtd

            objStor = db.transaction(storeName, IDBTransaction.READ_WRITE or 'readwrite').objectStore(storeName)
            data = if config.blob then record.blob else record
            putReq = objStor.put(data, record.id)
            putReq.onsuccess = (evt) ->
                _CACHE[dbName][record.id] = record
                dtd.resolve(record)

            putReq.onerror = (evt) ->
                console.log(evt)
                dtd.reject()

            return dtd

    remove =
        websql: (id) ->
            mee = @
            config = @config
            db = config.db
            dbName = config.dbName
            storeName = config.storeName
            dtd = $.Deferred()

            if not id
                setTimeout(
                    -> dtd.reject()
                    0
                )
                return dtd

            db.transaction (transaction) ->

                transaction.executeSql(
                    "DELETE FROM #{storeName} WHERE id=?;"
                    [id]
                    ->
                        delete _CACHE[dbName][id]
                        dtd.resolve(id)
                    (_t, e) ->
                        console.log(e.stack)
                        dtd.reject()
                )

            return dtd

        indexeddb: (id) ->
            config = @config
            db = config.db
            storeName = config.storeName
            dbName = config.dbName

            dtd = $.Deferred()

            if not id
                setTimeout(
                    -> dtd.reject()
                    0
                )
                return dtd

            objStor = db.transaction(storeName, IDBTransaction.READ_WRITE or 'readwrite').objectStore(storeName)
            deleteReq = objStor.delete(id)
            deleteReq.onsuccess = ->
                delete _CACHE[dbName][id]
                dtd.resolve(id)

            deleteReq.onerror = (evt) ->
                console.log(evt)
                dtd.reject()

            return dtd

    clear =
        websql: ->
            mee = @
            config = @config
            db = config.db
            dbName = config.dbName
            storeName = config.storeName
            dtd = $.Deferred()

            db.transaction (transaction) ->

                transaction.executeSql(
                    "DELETE FROM #{storeName}"
                    []
                    ->
                        dtd.resolve()
                    (_t, e) ->
                        console.log(e.stack)
                        dtd.reject()
                )

            return dtd

        indexeddb: ->
            config = @config
            db = config.db
            storeName = config.storeName
            dbName = config.dbName

            dtd = $.Deferred()

            objStor = db.transaction(storeName, IDBTransaction.READ_WRITE or 'readwrite').objectStore(storeName)
            clearReq = objStor.clear()
            clearReq.onsuccess = ->
                _CACHE[dbName] = {}
                dtd.resolve()

            clearReq.onerror = (evt) ->
                console.log(evt)
                dtd.reject()

    newInstance = (params) ->

        dtd = $.Deferred()

        if params is undefined
            return

        config = {}
        $.extend true, config, localDBConfig, params
        dbType = globalDBConfig.type
        config.dbName = "#{config.userId}-#{config.storeName}"
        _CACHE[config.dbName] = {}

        $.when(open[dbType](config))
        .done (db) ->
            config.db = db
            instance =
                config: config
                create: create[dbType]
                update: update[dbType]
                read: read[dbType]
                readAll: readAll[dbType]
                remove: remove[dbType]
                clear: clear[dbType]
                _convertToObject: if config.blob
                then (blob, id) -> return {id: id, blob: blob}
                else (record) ->
                    try
                        return JSON.parse(record)
                    catch e
                        return record

            dtd.resolve(instance)
        .fail ->
            dtd.reject()

        return dtd

    return {newInstance: newInstance}
)
