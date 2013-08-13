({
    baseUrl: '.'
    paths: {
        dbjs: 'libs/dbjs'
    },
    shim: {
        'dbjs/db': ['dbjs/defer']
    }
})
