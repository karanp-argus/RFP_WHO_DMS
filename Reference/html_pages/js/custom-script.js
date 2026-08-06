/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
//$document.ready(function () {
$(".mobile-menu").click(function () {
    $(this).toggleClass("close-menu");


    $('.sidebar').toggle();

});
//});

$(".close-sidebar").click(function(){
    $('.sidebar').hide();
    $(".mobile-menu").removeClass("close-menu");
})

