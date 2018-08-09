/**
 * var bootstrap loads modules
 *
 * @param  {type} client        description the instance of SIOSClient to configure
 * @param  {type} configuration description a JSON object with the following structure
 *                               {
 *                                  "uuid": 767697-6757667rt-45e5e5-7656u6,
 *                                  "modules": ["m1", "m2", ...],
 *                                  "m1" : {...},
 *                                  "m2" : {...},
 *                                  ...
 *                               }
 */
var bootstrap = function(client, configuration, env) {

  client.getConfiguration = function() {
    return configuration;
  };

  var modules = configuration.modules;
  if (configuration.modules === '*') {
    modules = _.keys(SIOSClient.modules);
    configuration.modules = modules;
  }

  for (var i = 0; i < modules.length; i++) {
    SIOSClient.modules[modules[i]](client, configuration, env);
  }
};



/**
 * SIOSClient - description
 *
 * @return {type}  description
 */
function SIOSClient() {

    console.log('SIOSClient start');
  var args = Array.prototype.slice.apply(arguments);
  var callback = args.pop();

  if (!(this instanceof SIOSClient)) {
    return new SIOSClient(args, callback);
  }

  var env = {
    socket: io()
  };

// console.log('SIOSClient ' + JSON.stringify(env));
  if (args.length) {
    if (typeof args[0] === 'object') {
      options = args[0];
    }
    // else if (typeof args[0] === 'string') {
    //   options.modules = args;
    // }
  }

  // for use with either "new SIOSClient('*', callback...)
  // or with "new SIOSClient(callback...)"
  // if (!options.modules || options.modules[0] === '*') {
  //   options.modules = [];
  //   for (m in SIOSClient.modules) {
  //     options.modules.push(m);
  //   }
  // }

  var self = this;
  env.socket.on('bootstrap', function(configuration) {

    // first, bootstrap the system
    bootstrap(self, configuration, env);

    // then release control
    callback(self);
  });

  console.log('SIOSClient start');
}



/**
 * var getOrCreateList - lazy initializer for lists that modules need to share
 *
 * @param  {type} env      map of unique run-time tweaks
 * @param  {type} listName the name of the list to get or create
 * @return {type}          the property of env identified by 'listName'
 */
var getOrCreateList = function(env, listName) {
  if (!env[listName]) {
    env[listName] = [];
  }
  return env[listName];
};


/**
 * var using - determines if the configuration from the server supports the
 * dependenciesfor this module
 *
 * @param  {object} configuration an object with a modules property
 * @param  {array}  dependencies  description
 * @return {boolean}               description
 */
var using = function(configuration, dependencies) {
  return configuration.modules !== '*' || _.forEach(dependencies, function(dep) {
    return _.includes(configuration.modules, dep);
  });
};


/**
 * A map to store the SIOSClient modules in
 */
SIOSClient.modules = {

  /**
   * dom - description
   *
   * @param  {type} client        description
   * @param  {type} configuration description
   * @param  {type} env           description
   * @return {type}               description
   */
    'dom' : function(client, configuration, env) {
        var $el = $(configuration.el || 'body');
        client.get$Root = function() {
            return $el;
        };
    },

  /**
   * users - description
   *
   * @param  {type} client        description
   * @param  {type} configuration description
   * @param  {type} env           description
   * @return {type}               description
   */
   'users' : function(client, configuration, env) {

         var users = [];
         client.getUsers = function() {
             return users;
         };

         env.socket.on('users', function(data) {
             var oldUsers = users;
             users = data.users;
             _.forEach(getOrCreateList(env, 'usersListeners'), function(listener) {
                 listener.handleUsersEvent(oldUsers, users);
             });
         });
     },

    'broadcast' : function(client, configuration, env) {
        env.socket.on('broadcast', function(data) {

            if (data.user) {
                // message is from
                _.forEach(getOrCreateList(env, 'userBroadcastListeners'), function(listener) {
                    listener.handleUserBroadcastEvent(data.user, data.message);
                });
            }
            else {
                // console.log('broadcast received');
                _.forEach(getOrCreateList(env, 'serverBroadcastListeners'), function(listener) {
                    console.log('broadcast received');
                    listener.handleServerBroadcastEvent(data.message);
                });
            }
        });
    },


  /**
   * messaging - description
   *
   * @param  {type} client        description
   * @param  {type} configuration description
   * @param  {type} env           description
   * @return {type}               description
   */
  'broadcastRendering' : function(client, configuration, env) {

    if (!using(configuration, ['dom', 'broadcast'])) {
      return; // module dependencies not met
    }

    if (using(configuration, ['users'])) {
        client.handleUserBroadcastEvent = function(user, message) {
            var $broadcast = $('<broadcast/>');
            $broadcast.addClass('user');
            $broadcast.append('<user>' + user + ':<user>');
            $broadcast.append('<message>' + message + '<message>');

            client['get$Root']().append($broadcast);
        };
        getOrCreateList(env, 'userBroadcastListeners').push(client);
    }

    client.handleServerBroadcastEvent = function(message) {
        var $broadcast = $('<broadcast/>');
        $broadcast.append('<message>' + message + '<message>');

        client['get$Root']().append($broadcast);
    };
    getOrCreateList(env, 'serverBroadcastListeners').push(client);

    client.handleUpdateUsersEvent = function(oldUsers, newUsers) {
      // adjust private messaging concerns
      console.log('oldUsers: ' + JSON.stringify(oldUsers));
      console.log('newUsers: ' + JSON.stringify(newUsers));
    };

    env.socket.on('addToChat', function(data) {
      // TODO: route message to correct window
      _.forEach(getOrCreateList(env, 'addToChatListeners'), function(listener) {
        listener.handleAddToChatEvent();
      });
    });
  },
};
