const CmsBlocksControllers = angular.module("aq.cmsBlocks.controllers", []);

CmsBlocksControllers.controller("CmsBlocksListCtrl", [
    "$scope", "$location", "CmsBlocksApi", "$rootScope", function ($scope, $location, CmsBlocksApi, $rootScope) {
        $scope.groups = [];
        $scope.currentTab = "";
        $scope.search = "";

        $scope.defaultLang = $rootScope.languages.find(function (lang) {
            return lang.defaultLanguage;
        }).code;

        CmsBlocksApi.list({PostBody: {filter: {_id: {$ne: null}}, structure: '*', limit: 99}}, function (cmsBlocks) {
            $scope.cmsBlocks = cmsBlocks.datas;
            $scope.groups = cmsBlocks.datas.getAndSortGroups();
            $scope.currentTab = $scope.groups[0];

            const adminStoredDatas = JSON.parse(window.localStorage.getItem('pageAdmin')) || {};

            if (adminStoredDatas && adminStoredDatas.cmsListTab && $scope.groups.includes(adminStoredDatas.cmsListTab)) {
                $scope.currentTab = adminStoredDatas.cmsListTab;
            } else {
                adminStoredDatas.cmsListTab = $scope.groups[0];
                window.localStorage.setItem('pageAdmin', JSON.stringify(adminStoredDatas))
            }
        });

        $scope.goToCmsBlockDetails = function (blockId) {
            $location.path(`/cmsBlocks/${blockId}`);
        };

        $scope.changeTab = function(group) {
            $scope.currentTab = group;
            if (window.localStorage.getItem('pageAdmin')) {
                const adminStoredDatas = JSON.parse(window.localStorage.getItem('pageAdmin'));
                adminStoredDatas.cmsListTab = group;
                window.localStorage.setItem('pageAdmin', JSON.stringify(adminStoredDatas))
            } else {
                const adminStoredDatas = {cmsListTab: group};
                window.localStorage.setItem('pageAdmin', JSON.stringify(adminStoredDatas))
            }
        }
    }
]);

CmsBlocksControllers.controller("CmsBlocksDetailCtrl", [
    "$scope", "CmsBlocksApi", "$routeParams", "$location", "toastService", "$http","$modal","$rootScope",
    function ($scope, CmsBlocksApi, $routeParams, $location, toastService, $http, $modal, $rootScope) {
        $scope.isEditMode = false;
        $scope.lang = $rootScope.adminLang;
        $scope.modules = [];
        $scope.groups = [];

        $scope.getGroups = function () {
            $scope.itemObjectSelected = function (item) {
                $scope.selectedDropdownItem = item;
            };
    
            $scope.filterDropdown = function (userInput) {
                if (userInput !== undefined) {
                    $scope.selectedDropdownItem = userInput;
                }
                return CmsBlocksApi.list({PostBody: {filter: {}, structure: '*', limit: 99}}).$promise.then(function (cmsBlocks) {
                    $scope.groups = cmsBlocks.datas.getAndSortGroups($scope.selectedDropdownItem)
                    return $scope.groups;
                });
            };
    
            $scope.filterDropdown();
        }
        if ($routeParams.code !== "new") {
            CmsBlocksApi.query({PostBody: {filter: {code: $routeParams.code}, structure: '*', limit: 1}}, function (block) {
                $scope.cmsBlock = block;
                $scope.isEditMode = true;
                $scope.selectedDropdownItem = block.group ? block.group : "";
                if(!$scope.cmsBlock.translation[$scope.lang].html) {
                    $scope.cmsBlock.translation[$scope.lang].html = $scope.cmsBlock.translation[$scope.lang].content
                }

                $scope.getGroups()
            });
        } else {
            $scope.cmsBlock = {group: ""};
            $scope.selectedDropdownItem = "";

            $scope.getGroups()
        }

        $scope.generateVariables = function () {
            if($scope.cmsBlock.translation[$scope.lang] && $scope.cmsBlock.translation[$scope.lang].html) {
                var originalArray = $scope.cmsBlock.translation[$scope.lang].variables || [],
                    founds        = [...$scope.cmsBlock.translation[$scope.lang].html.matchAll(/{{([^}]*)}}/gm)]
                $scope.cmsBlock.translation[$scope.lang].variables = [];
                for (var i = 0; i < founds.length; i++) {
                    if(originalArray.find(_var => _var.label === founds[i][1])) {
                        $scope.cmsBlock.translation[$scope.lang].variables.push(originalArray.find(_var => _var.label === founds[i][1]))
                    } else {
                        $scope.cmsBlock.translation[$scope.lang].variables.push({label: founds[i][1], value: ''})
                    }
                }
            }
        }

        $scope.generateContent = function () {
            if ($scope.cmsBlock.translation[$scope.lang] && $scope.cmsBlock.translation[$scope.lang].html) {

                var founds = [...$scope.cmsBlock.translation[$scope.lang].html.matchAll(/{{([^}]*)}}/gm)];
                
                $scope.cmsBlock.translation[$scope.lang].content = $scope.cmsBlock.translation[$scope.lang].html;
                var missingVariables = [];
            
                for (var i = 0; i < founds.length; i++) {
                    var variable = $scope.cmsBlock.translation[$scope.lang].variables.find(_var => _var.label === founds[i][1])
                    if(variable) {
                        $scope.cmsBlock.translation[$scope.lang].content = $scope.cmsBlock.translation[$scope.lang].content.replace(founds[i][0], variable ? variable.value : '')
                    } else {
                        missingVariables.push(founds[i][1])
                    }
                }
                
                if (missingVariables.length) {
                    toastService.toast("danger", `Warning: Variables missing (${missingVariables.join(', ')})`);
                }
            }
        } 

        $scope.save = async function (quit) {
            if(!$scope.cmsBlock || !$scope.cmsBlock.code || $scope.cmsBlock.code === "") return;
            $scope.cmsBlock.group = $scope.selectedDropdownItem === "" ? null : $scope.selectedDropdownItem;
            $scope.generateContent()

            await CmsBlocksApi.save($scope.cmsBlock, function (res) {
                toastService.toast("success", "Bloc CMS sauvegardé !");
                if (quit) {
                    $location.path("/cmsBlocks");
                }else{
                    if ($routeParams.code !== $scope.cmsBlock.code) { // si différent (donc création)
                        $location.path(`/cmsBlocks/${$scope.cmsBlock.code}`);
                    }
                }
            });

            
        };

        $scope.delete = function () {
            if (confirm("Êtes-vous sûr de vouloir supprimer ce bloc CMS ?")) {
                CmsBlocksApi.delete({code: $scope.cmsBlock.code}, function (response) {
                    toastService.toast("success", "Bloc supprimé");
                    $location.path("/cmsBlocks");
                }, function (err) {
                    console.error(err);
                    toastService.toast("danger", "Echec de la suppresion");
                });
            }
            // CmsBlocksApi.delete({id: block.id}, function(){
            //     $scope.cmsBlocks.splice($scope.cmsBlocks.indexOf(block), 1);
            // });
        };

        $scope.langChange = function (lang) {
            $scope.lang = lang;
            if(!$scope.cmsBlock.translation[lang].html) {
                $scope.cmsBlock.translation[lang].html = $scope.cmsBlock.translation[lang].content
            }
        }

        $http.post('/v2/modules', {
            PostBody: {
                filter: {},
                limit: 100,
                populate: [],
                skip: 0,
                sort: {},
                structure: {},
                page: null
            }
        }).then(function (response) {
            $scope.modules = response.data.datas.filter(module => module.component_template_front);
        });

        $scope.showModulesTags = function () {
            let tagText = '';
            for (let i = 0; i < $scope.modules.length; i++) {
                tagText += `${$scope.modules[i].component_template_front}\n`;
            }
            return tagText;
        };
    }
]);
