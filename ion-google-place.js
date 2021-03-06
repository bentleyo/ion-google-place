angular.module('ion-google-place', ['uiGmapgoogle-maps'])
    .directive('ionGooglePlace',
    function ($ionicTemplateLoader, $ionicBackdrop, $ionicPlatform, $q, $timeout, $rootScope, $document,
              uiGmapGoogleMapApi, $log, $ionicPopup) {
        return {
            require: '?ngModel',
            restrict: 'E',
            template: '<input type="text" readonly="readonly" class="ion-google-place" autocomplete="off">',
            replace: true,
            scope: {
                ngModel: '=?',
                geocodeOptions: '=',
                geolocationDisabled: '=?' 
            },
            link: function (scope, element, attrs, ngModel) {
                var unbindBackButtonAction;
                var geocoder, autoCompleteService;

                scope.locations = [];
                if (uiGmapGoogleMapApi) {
                    uiGmapGoogleMapApi.then(function () {
                        geocoder = new google.maps.Geocoder();
                        autoCompleteService = new google.maps.places.AutocompleteService();
                    });
                } else {
                    geocoder = new google.maps.Geocoder();
                    autoCompleteService = new google.maps.places.AutocompleteService();
                }

                var searchEventTimeout = undefined;

                var POPUP_TPL = [
                    '<div class="ion-google-place-container modal">',
                    '<div class="bar bar-header item-input-inset">',
                    '<label class="item-input-wrapper">',
                    '<input class="google-place-search" type="search" ng-model="searchQuery" placeholder="' + (attrs.searchPlaceholder || 'Enter an address, place or ZIP code') + '">',
                    '</label>',
                    '<button class="button button-clear">',
                    attrs.labelCancel || 'Cancel',
                    '</button>',
                    '</div>',
                    '<ion-content class="has-header has-header" ng-click="onBackdropClicked()">',
                    '<ion-list>',
                    '<ion-item type="item-text-wrap" class="item-location item-geolocation" ng-click="setCurrentLocation()" ng-if="geolocationAvailable && !geolocationDisabled">',
                    'Use current location',
                    '</ion-item>',
                    '<ion-item ng-repeat="location in locations" type="item-text-wrap" ng-click="selectLocation(location)">',
                    '{{location.description}}',
                    '</ion-item>',
                    '<ion-item type="item-text-wrap" class="item-location">',
                    '<div style="height:16px;">',
                    '<span style="display: inline-block;height: 100%;vertical-align: middle;"></span>',
                    '<img ng-src="{{attributionLogo}}">',
                    '</div>',
                    '</ion-item>',
                    '</ion-list>',
                    '</ion-content>',
                    '</div>'
                ].join('');

                var popupPromise = $ionicTemplateLoader.compile({
                    template: POPUP_TPL,
                    scope: scope,
                    appendTo: $document[0].body
                });

                function showAlert(text) {
                    $ionicPopup.alert({
                        title: 'Location Error',
                        content: text
                    }).then(function (res) {
                        console.log('Test Alert Box');
                    });
                };

                popupPromise.then(function (el) {
                    var searchInputElement = angular.element(el.element.find('input'));

                    scope.onBackdropClicked = function () {
                        el.element.css('display', 'none');
                        $ionicBackdrop.release();

                        if (unbindBackButtonAction) {
                            unbindBackButtonAction();
                            unbindBackButtonAction = null;
                        }
                    };

                    scope.attributionLogo = "data:image/png;base64,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";

                    scope.geolocationAvailable = !!navigator.geolocation;

                    scope.selectLocation = function (location) {
                        //document.getElementById("q")
                        var googlePlacesService = new google.maps.places.PlacesService(document.createElement('div'));
                        googlePlacesService.getDetails({
                            reference: location.reference
                        }, function (details, status) {
                            if (details) {
                                //get latlng from placeid
                                ngModel.$setViewValue(details);
                                ngModel.$render();
                                el.element.css('display', 'none');
                                $ionicBackdrop.release();

                                if (unbindBackButtonAction) {
                                    unbindBackButtonAction();
                                    unbindBackButtonAction = null;
                                }
                            }
                        });
                    };

                    function setLocationInner() {
                        var location = {
                            formatted_address: 'getting current location...'
                        };
                        ngModel.$setViewValue(location);
                        element.attr('value', location.formatted_address);
                        ngModel.$render();
                        el.element.css('display', 'none');
                        $ionicBackdrop.release();

                        if (unbindBackButtonAction) {
                            unbindBackButtonAction();
                            unbindBackButtonAction = null;
                        }
                        getLocation()
                            .then(reverseGeocoding)
                            .then(function (location) {
                                ngModel.$setViewValue(location);
                                element.attr('value', location.formatted_address);
                                ngModel.$render();
                                el.element.css('display', 'none');
                                $ionicBackdrop.release();
                            })
                            .catch(function (error) {
                                ngModel.$setViewValue(null);
                                ngModel.$render();
                                el.element.css('display', 'none');
                                $ionicBackdrop.release();
                            });
                    }

                    scope.setCurrentLocation = function () {
                        return new Promise(function (resolve, reject) {
                            try {
                                cordova.plugins.locationAccuracy.request(function success(result) {
                                    resolve(result);
                                }, function error(err) {
                                    reject(err);
                                }, cordova.plugins.locationAccuracy.REQUEST_PRIORITY_HIGH_ACCURACY);
                            } catch (err) {
                                reject(err);
                            }
                        })
                            .then(function (result) {
                                setLocationInner(result);
                            })
                            .catch(function (err) {
                                if (err.message == 'cordova is not defined') {
                                    $log.warn("locationaccuracy plugin is not defined (only available on the device since it's a native cordova plugin");
                                    //we are in the browser, not on android native, so try getting location nonetheless
                                    setLocationInner();
                                }
                                else {
                                    //this happens on ios
                                    isLocationEnbledIos()
                                        .then(getIosPermission)
                                        .then(checkIosPermission)
                                        .then(function () {
                                            setLocationInner();
                                        })
                                        .catch(function (err) {
                                            if (err.message === 'permission denied') {
                                                showAlert('Permission denied. Please give RoadAtlas permission to use gps, to use this feature.');
                                            } else if (err.message === 'location deactivated') {
                                                showAlert('Your gps is off. Please turn it on to use this feature.');
                                            }
                                        })
                                }

                                //TODO activate gps if necessary

                            });
                    };

                    function getIosPermission() {
                        return new Promise(function (resolve, reject) {
                            try {
                                cordova.plugins.diagnostic.getLocationAuthorizationStatus(function (permission) {
                                    resolve(permission)
                                }, function (err) {
                                    reject(err);
                                });
                            } catch (err) {
                                reject(err);
                            }
                        })
                    }

                    function checkIosPermission(permission) {
                        return new Promise(function (resolve, reject) {
                            try {
                                if (permission === 'not_determined') {
                                    cordova.plugins.diagnostic.requestLocationAuthorization(function () {
                                        resolve();
                                    }, function (err) {
                                        reject(err);
                                    }, "when_in_use");
                                } else if (permission === 'denied') {
                                    reject(new Error('permission denied'));
                                }
                            } catch (err) {
                                reject(err);
                            }
                        })
                    }

                    function isLocationEnbledIos() {
                        return new Promise(function (resolve, reject) {
                            try {
                                cordova.plugins.diagnostic.isLocationEnabledSetting(function (enabled) {
                                    if (enabled) {
                                        resolve();
                                    } else {
                                        reject(new Error('location deactivated'));
                                    }
                                }, function (err) {
                                    reject(err);
                                });
                            } catch (err) {
                                reject(err);
                            }
                        })
                    }

                    scope.$watch('ngModel', function (ngModel) {
                        if (scope.ngModel && scope.ngModel.formatted_address) {
                            element.val(scope.ngModel.formatted_address);
                        }
                    });

                    scope.$watch('searchQuery', function (query) {
                        if (searchEventTimeout) $timeout.cancel(searchEventTimeout);
                        searchEventTimeout = $timeout(function () {
                            if (!query) return;
                            if (query.length < 3);

                            var req = scope.geocodeOptions || {};
                            req.address = query;
                            autoCompleteService.getPlacePredictions({
                                input: query
                            }, function (predictions, status) {
                                if (status != google.maps.places.PlacesServiceStatus.OK) {
                                    $log.warn(status);
                                    return;
                                }
                                scope.$apply(function () {
                                    scope.locations = predictions;
                                });
                            });


                            /* geocoder.geocode(req, function (results, status) {
                             if (status == google.maps.GeocoderStatus.OK) {
                             scope.$apply(function () {
                             scope.locations = results;
                             });
                             } else {
                             // @TODO: Figure out what to do when the geocoding fails
                             }
                             });
                             */
                        }, 350); // we're throttling the input by 350ms to be nice to google's API
                    });

                    var onClick = function (e) {
                        e.preventDefault();
                        e.stopPropagation();

                        $ionicBackdrop.retain();
                        unbindBackButtonAction = $ionicPlatform.registerBackButtonAction(closeOnBackButton, 250);

                        el.element.css('display', 'block');
                        searchInputElement[0].focus();
                        setTimeout(function () {
                            searchInputElement[0].focus();
                        }, 0);
                    };

                    var onCancel = function (e) {
                        scope.searchQuery = '';
                        $ionicBackdrop.release();
                        el.element.css('display', 'none');

                        if (unbindBackButtonAction) {
                            unbindBackButtonAction();
                            unbindBackButtonAction = null;
                        }
                    };

                    closeOnBackButton = function (e) {
                        e.preventDefault();

                        el.element.css('display', 'none');
                        $ionicBackdrop.release();

                        if (unbindBackButtonAction) {
                            unbindBackButtonAction();
                            unbindBackButtonAction = null;
                        }
                    };

                    element.bind('click', onClick);
                    element.bind('touchend', onClick);

                    el.element.find('button').bind('click', onCancel);
                });

                if (attrs.placeholder) {
                    element.attr('placeholder', attrs.placeholder);
                }


                if (scope.ngModel && scope.ngModel.formatted_address) {
                    ngModel.$setViewValue(scope.ngModel);
                    element.val(scope.ngModel.formatted_address);
                }


                ngModel.$formatters.unshift(function (modelValue) {
                    if (!modelValue) return '';
                    return modelValue;
                });

                ngModel.$parsers.unshift(function (viewValue) {
                    return viewValue;
                });

                ngModel.$render = function () {
                    if (!ngModel.$viewValue) {
                        element.val('');
                    } else {
                        element.val(ngModel.$viewValue.formatted_address || '');
                    }
                };

                function getLocation() {
                    return $q(function (resolve, reject) {
                        navigator.geolocation.getCurrentPosition(function (position) {
                            resolve(position);
                        }, function (error) {
                            error.from = 'getLocation';
                            reject(error);
                        }, {timeout: 10000});
                    });
                }

                function reverseGeocoding(location) {
                    return $q(function (resolve, reject) {
                        var latlng = {
                            lat: location.coords.latitude,
                            lng: location.coords.longitude
                        };
                        geocoder.geocode({'location': latlng}, function (results, status) {
                            if (status == google.maps.GeocoderStatus.OK) {
                                if (results[1]) {
                                    resolve(results[1]);
                                } else {
                                    resolve(results[0])
                                }
                            } else {
                                var error = {
                                    status: status,
                                    from: 'reverseGeocoding'
                                };
                                reject(error);
                            }
                        })
                    });
                }

                scope.$on("$destroy", function () {
                    if (unbindBackButtonAction) {
                        unbindBackButtonAction();
                        unbindBackButtonAction = null;
                    }
                });
            }
        };
    });
