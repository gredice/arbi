// controller-buck-converter-48v-5v — r0.1.1, concept-unvalidated.
// Same received fixed-5 V module as the pod; measured envelope, simplified detail.
include <../../lib/buck-converter-48v-5v.scad>

module cabinet_controller_converter() {
    buck_converter_48v_5v();
}
cabinet_controller_converter();
