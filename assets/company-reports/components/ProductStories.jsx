import React from 'react';
import PropTypes from 'prop-types';
import ReportsTable from './ReportsTable';
import { sortBy, cloneDeep } from 'lodash';
import { gettext } from 'utils';
import {toggleFilterAndQuery, runReport, REPORTS, fetchAggregations} from '../actions';
import {connect} from "react-redux";
import MultiSelectDropdown from "../../components/MultiSelectDropdown";


class ProductStories extends React.Component {
    constructor(props, context) {
        super(props, context);

        this.products = sortBy([...this.props.products.map((p) => ({
            ...p,
            'label': p.name}))
            .concat(...this.props.monitoring.map((m) => ({
                ...m,
                'label': m.name,
                'product_type': 'monitoring'
            })))], ['product_type']);
        this.props.reportParams.section = null;
        this.props.reportParams.product = null;
        this.onChangeSection = this.onChangeSection.bind(this);

        this.state = {
            filters: ['section', 'product'],
            results: [],
            section: {
                field: 'section',
                label: gettext('Sections'),
                options: [],
                onChange: this.onChangeSection,
                showAllButton: true,
                multi: false,
                default: null,
            },
            product: {
                field: 'product',
                label: gettext('Products'),
                options: [],
                onChange: this.props.toggleFilterAndQuery,
                showAllButton: true,
                multi: false,
                default: null,
            },
        };
    }

    componentWillMount() {
        this.props.fetchAggregations(REPORTS['product-stories']);
        // Run report on initial loading with default filters
        this.props.runReport();
    }

    componentWillReceiveProps(nextProps) {
        if (this.props.aggregations !== nextProps.aggregations) {
            this.updateAggregations(nextProps);
        }
    }

    onChangeSection(field, value) {
        this.props.reportParams.product = null;
        this.props.toggleFilterAndQuery('section', value);
        this.props.fetchAggregations(REPORTS['product-stories']);
    }

    updateAggregations(props) {
        const section = cloneDeep(this.state.section);
        const product = cloneDeep(this.state.product);

        if (!props.reportParams.section) {
            section.options = props.sections
                .map((section) => ({
                    label: section.name,
                    value: section.name,
                }));
        }
        product.options = this.products
            .filter((product) => props.aggregations.products.includes(product._id))
            .map((product) => ({
                label: props.reportParams.section ? product.name : product.name.concat(' - ', this.getProductSectionName(product.product_type)),
                value: props.reportParams.section ? product.name : product.name.concat('|', this.getProductSectionName(product.product_type)),
            }));

        this.setState({
            section,
            product,
        });
    }

    getProductSectionName(productType) {
        const { sections } = this.props;
        let section = sections.find(s => s._id === productType);
        return section ? section.name : productType;
    }

    render() {
        const {results, print, reportParams} = this.props;
        const {filters} = this.state;
        const headers = [
            gettext('Product'),
            gettext('Is Enabled'),
            gettext('Today'),
            gettext('Last 24 hours'),
            gettext('This week'),
            gettext('Last 7 days'),
            gettext('This month'),
            gettext('Previous month'),
            gettext('Last 6 months'),
        ];
        const list = results && results.map((item) =>
            <tr key={item._id}>
                <td>{item.name}{!reportParams.section && <span className="font-italic"> {this.getProductSectionName(item.product_type)}</span>}</td>
                <td>{item.is_enabled.toString()}</td>
                <td>{item.today}</td>
                <td>{item.last_24_hours}</td>
                <td>{item.this_week}</td>
                <td>{item.last_7_days}</td>
                <td>{item.this_month}</td>
                <td>{item.previous_month}</td>
                <td>{item.last_6_months}</td>
            </tr>
        );

        let filterNodes = filters.map((filterName) => {
            const filter = this.state[filterName];

            return (
                <MultiSelectDropdown
                    key={filterName}
                    {...filter}
                    values={reportParams[filter.field] || filter.default}
                />
            );
        });
        const filterSection = (<div key='report_filters' className="align-items-center d-flex flex-sm-nowrap flex-wrap m-0 px-3 wire-column__main-header-agenda">{filterNodes}</div>);

        return [filterSection,
            (<ReportsTable key='report_table' headers={headers} rows={list} print={print} />)];
    }
}

ProductStories.propTypes = {
    results: PropTypes.array,
    print: PropTypes.bool,
    products: PropTypes.array,
    sections: PropTypes.array,
    monitoring: PropTypes.array,
    reportParams: PropTypes.object,
    toggleFilterAndQuery: PropTypes.func,
    runReport: PropTypes.func,
    isLoading: PropTypes.bool,
    fetchAggregations: PropTypes.func,
    aggregations: PropTypes.object,
};

const mapStateToProps = (state) => ({
    products: state.products,
    sections: state.sections,
    monitoring: state.monitoring,
    reportParams: state.reportParams,
    isLoading: state.isLoading,
    aggregations: state.reportAggregations,
});

const mapDispatchToProps = { toggleFilterAndQuery, runReport, fetchAggregations};

export default connect(mapStateToProps, mapDispatchToProps)(ProductStories);